using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("Soundpad")]
[assembly: AssemblyDescription("Soundpad local para SMK-25")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

internal static class Launcher
{
    const string Address = "http://127.0.0.1:3210";
    static Process server;
    static IntPtr processJob = IntPtr.Zero;
    static string home;
    static readonly object logLock = new object();

    [STAThread]
    static int Main(string[] args)
    {
        bool test = Array.IndexOf(args, "--self-test") >= 0;
        home = Environment.GetEnvironmentVariable("SOUNDPAD_HOME");
        if (String.IsNullOrWhiteSpace(home)) home = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Soundpad");
        home = Path.GetFullPath(home);
        Directory.CreateDirectory(home);
        bool first;
        string user = Environment.UserName.Replace('\\', '_');
        using (Mutex mutex = new Mutex(true, "Local\\Soundpad-" + user, out first))
        {
            if (!first) { if (!test) OpenBrowser(); return 0; }
            try
            {
                Application.EnableVisualStyles();
                if (IsRunning())
                {
                    if (test) throw new InvalidOperationException("A porta 3210 já está em uso pelo Soundpad. Encerre a outra instância antes do teste.");
                    OpenBrowser(); return 0;
                }
                string runtime = ExtractRuntime();
                ProcessStartInfo start = new ProcessStartInfo(Path.Combine(runtime, "node.exe"), "\"" + Path.Combine(runtime, "server.mjs") + "\"");
                start.WorkingDirectory = runtime;
                start.UseShellExecute = false;
                start.CreateNoWindow = true;
                start.RedirectStandardOutput = true;
                start.RedirectStandardError = true;
                start.EnvironmentVariables["SOUNDPAD_DATA_DIR"] = Path.Combine(home, "data");
                start.EnvironmentVariables["PATH"] = runtime + ";" + Path.Combine(runtime, "tools") + ";" + Environment.GetEnvironmentVariable("PATH");
                server = new Process(); server.StartInfo = start;
                server.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) { Log(e.Data); };
                server.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e) { Log(e.Data); };
                server.Start(); AttachProcessJob(server); server.BeginOutputReadLine(); server.BeginErrorReadLine();
                bool ready = false;
                for (int i = 0; i < 120; i++)
                {
                    if (server.HasExited) throw new InvalidOperationException("O servidor não iniciou. Consulte server.log na pasta de dados.");
                    if (IsRunning()) { ready = true; break; }
                    Thread.Sleep(250);
                }
                if (!ready) throw new TimeoutException("O servidor demorou para iniciar.");
                if (test)
                {
                    string status = Get("/api/status");
                    if (!status.Contains("\"youtube\":true") || !status.Contains("\"ffmpeg\":true")) throw new InvalidOperationException("Ferramentas de mídia indisponíveis: " + status);
                    if (!Get("/").Contains("SOUNDPAD")) throw new InvalidOperationException("Interface não encontrada.");
                    if (Get("/api/setup").Trim() != "null") throw new InvalidOperationException("O pacote de teste não deveria conter dados de usuário.");
                    File.WriteAllText(Path.Combine(home, "self-test.txt"), "PASS\r\nServidor, interface, Node.js, FFmpeg e yt-dlp verificados.\r\nDados isolados: " + Path.Combine(home, "data"));
                    return 0;
                }
                using (NotifyIcon tray = new NotifyIcon())
                using (ContextMenuStrip menu = new ContextMenuStrip())
                {
                    tray.Icon = SystemIcons.Application;
                    tray.Text = "Soundpad";
                    menu.Items.Add("Abrir Soundpad", null, delegate { OpenBrowser(); });
                    menu.Items.Add("Abrir pasta de dados", null, delegate { Process.Start(new ProcessStartInfo(home) { UseShellExecute = true }); });
                    menu.Items.Add("Encerrar Soundpad", null, delegate { Application.Exit(); });
                    tray.ContextMenuStrip = menu;
                    tray.DoubleClick += delegate { OpenBrowser(); };
                    tray.Visible = true;
                    OpenBrowser();
                    Application.Run();
                    tray.Visible = false;
                }
                return 0;
            }
            catch (Exception error)
            {
                Log(error.ToString());
                if (test) File.WriteAllText(Path.Combine(home, "self-test.txt"), "FAIL\r\n" + error);
                else MessageBox.Show(error.Message, "Soundpad", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
            finally { StopServer(); mutex.ReleaseMutex(); }
        }
    }

    static string ExtractRuntime()
    {
        using (Stream payload = Assembly.GetExecutingAssembly().GetManifestResourceStream("Soundpad.payload.zip"))
        {
            if (payload == null) throw new InvalidOperationException("Pacote interno ausente.");
            string hash;
            using (SHA256 sha = SHA256.Create()) hash = BitConverter.ToString(sha.ComputeHash(payload)).Replace("-", "").Substring(0, 16);
            payload.Position = 0;
            string target = Path.Combine(home, "runtime", hash);
            string marker = Path.Combine(target, ".complete");
            if (File.Exists(marker)) return target;
            Directory.CreateDirectory(target);
            string prefix = Path.GetFullPath(target) + Path.DirectorySeparatorChar;
            using (ZipArchive zip = new ZipArchive(payload, ZipArchiveMode.Read))
            {
                foreach (ZipArchiveEntry entry in zip.Entries)
                {
                    string file = Path.GetFullPath(Path.Combine(target, entry.FullName));
                    if (!file.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Caminho inválido no pacote.");
                    if (String.IsNullOrEmpty(entry.Name)) { Directory.CreateDirectory(file); continue; }
                    Directory.CreateDirectory(Path.GetDirectoryName(file));
                    using (Stream input = entry.Open()) using (FileStream output = File.Create(file)) input.CopyTo(output);
                }
            }
            File.WriteAllText(marker, hash);
            return target;
        }
    }
    static string Get(string route)
    {
        HttpWebRequest request = (HttpWebRequest)WebRequest.Create(Address + route);
        request.Proxy = null; request.Timeout = 15000;
        using (WebResponse response = request.GetResponse()) using (StreamReader reader = new StreamReader(response.GetResponseStream())) return reader.ReadToEnd();
    }
    static bool IsRunning() { try { return Get("/api/health").Contains("\"application\":\"soundpad\""); } catch { return false; } }
    static void OpenBrowser() { Process.Start(new ProcessStartInfo(Address) { UseShellExecute = true }); }
    static void Log(string message) { if (String.IsNullOrWhiteSpace(message)) return; lock (logLock) { try { File.AppendAllText(Path.Combine(home, "server.log"), DateTime.Now.ToString("s") + " " + message + Environment.NewLine); } catch {} } }
    static void StopServer()
    {
        if (server == null) return;
        try
        {
            if (processJob != IntPtr.Zero) { CloseHandle(processJob); processJob = IntPtr.Zero; }
            if (!server.HasExited) server.Kill();
            server.WaitForExit(5000);
        }
        catch {} finally { server.Dispose(); }
    }
    [StructLayout(LayoutKind.Sequential)]
    struct BasicLimits
    {
        public long ProcessTime, JobTime;
        public uint Flags;
        public UIntPtr MinimumWorkingSet, MaximumWorkingSet;
        public uint ActiveProcesses;
        public UIntPtr Affinity;
        public uint Priority, Scheduling;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct IoCounters { public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes; }
    [StructLayout(LayoutKind.Sequential)]
    struct ExtendedLimits
    {
        public BasicLimits Basic;
        public IoCounters Io;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr job, int kind, ref ExtendedLimits info, uint size);
    [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    static void AttachProcessJob(Process process)
    {
        IntPtr job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero) throw new InvalidOperationException("Não foi possível criar o grupo de processos.");
        ExtendedLimits limits = new ExtendedLimits(); limits.Basic.Flags = 0x2000; // Kill all child processes when the launcher closes.
        if (!SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(typeof(ExtendedLimits))) || !AssignProcessToJobObject(job, process.Handle))
        { CloseHandle(job); throw new InvalidOperationException("Não foi possível gerenciar o processo do servidor."); }
        processJob = job;
    }
}
