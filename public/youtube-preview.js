import { youtubeVideoId, youtubeRange, timestamp } from './youtube-range.js';

let apiPromise;
function loadAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => fail(), 15000);
    function fail() { clearTimeout(timer); script.remove(); apiPromise = null; reject(Error('Não foi possível carregar o player. Verifique a conexão ou tente novamente.')); }
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); resolve(window.YT); };
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = fail;
    document.head.append(script);
  });
  return apiPromise;
}

export function setupYoutubePreview() {
  const $ = id => document.getElementById(id);
  const dialog = $('import-dialog'), url = $('youtube-url');
  const start = $('youtube-start'), end = $('youtube-end');
  let player = null, loadedId = '', isReady = false, duration = 0, segment = null;
  let sequence = 0, ticker = null, playerTimeout = null;
  const status = text => { $('youtube-preview-status').textContent = text; };
  function enable(enabled) {
    for (const id of ['youtube-play-range', 'youtube-pause', 'youtube-mark-start', 'youtube-mark-end']) $(id).disabled = !enabled;
  }
  function pause() { segment = null; if (isReady) player?.pauseVideo(); $('youtube-imported-audio').pause(); }
  function clearPlayer() {
    clearInterval(ticker); clearTimeout(playerTimeout); ticker = null;
    player?.destroy(); player = null; isReady = false; duration = 0; loadedId = '';
    enable(false); $('youtube-position').textContent = '0:00.0';
  }
  function selection() {
    const id = youtubeVideoId(url.value);
    const range = youtubeRange(start.value, end.value, id === loadedId ? duration : 0);
    return { ...range, url: 'https://www.youtube.com/watch?v=' + id, id };
  }
  function updateRange() {
    if (segment && isReady) {
      player.pauseVideo();
      status('Trecho alterado. Clique em Ouvir trecho.');
    }
    segment = null;
    try {
      const range = youtubeRange(start.value, end.value, duration);
      $('youtube-range-summary').textContent = `${timestamp(range.start)} → ${timestamp(range.end)} · ${(range.end - range.start).toFixed(1)} s`;
      $('youtube-range-summary').classList.remove('invalid');
    } catch (error) {
      $('youtube-range-summary').textContent = error.message;
      $('youtube-range-summary').classList.add('invalid');
    }
  }
  async function load() {
    let id;
    try { id = youtubeVideoId(url.value); } catch (error) { status(error.message); return; }
    pause(); clearPlayer();
    const token = ++sequence;
    $('youtube-load').disabled = true;
    $('youtube-preview').hidden = false;
    status('Carregando vídeo…');
    try {
      const YT = await loadAPI();
      if (token !== sequence || !dialog.open) return;
      $('youtube-player-host').replaceChildren();
      const mount = document.createElement('div');
      $('youtube-player-host').append(mount);
      playerTimeout = setTimeout(() => {
        if (token !== sequence) return;
        status('O player não respondeu. Tente carregar novamente.');
        $('youtube-load').disabled = false;
      }, 15000);
      player = new YT.Player(mount, {
        width: '100%', height: '100%', videoId: id,
        playerVars: { origin: location.origin, playsinline: 1, rel: 0 },
        events: {
          onReady(event) {
            if (token !== sequence || !dialog.open) return;
            clearTimeout(playerTimeout);
            player = event.target; loadedId = id; isReady = true; enable(true);
            $('youtube-load').disabled = false;
            status('Use o player para localizar o trecho.');
            ticker = setInterval(() => {
              if (!isReady || !dialog.open) return;
              const time = player.getCurrentTime() || 0;
              duration = player.getDuration() || 0;
              $('youtube-position').textContent = `${timestamp(time)} / ${timestamp(duration)}`;
              if (segment?.started && time >= segment.end) { pause(); status('Fim do trecho.'); }
            }, 100);
          },
          onError(event) {
            if (token !== sequence) return;
            clearTimeout(playerTimeout); enable(false); segment = null;
            $('youtube-load').disabled = false;
            const messages = { 2: 'Link inválido.', 5: 'O navegador não conseguiu reproduzir este vídeo.', 100: 'Vídeo removido ou privado.', 101: 'O autor não permite prévia incorporada.', 150: 'O autor não permite prévia incorporada.', 153: 'O YouTube recusou a identificação do player neste navegador.' };
            status(messages[event.data] || 'Não foi possível reproduzir o vídeo.');
          },
          onAutoplayBlocked() { if (token === sequence) status('Clique em reproduzir dentro do vídeo para continuar.'); },
          onStateChange(event) {
            if (token !== sequence) return;
            if (event.data === 1 && segment) segment.started = true;
            if (event.data === 0 && segment) { segment = null; status('Fim do trecho.'); }
          }
        }
      });
    } catch (error) { if (token === sequence) { status(error.message); $('youtube-load').disabled = false; } }
  }
  $('youtube-load').onclick = load;
  url.addEventListener('input', () => {
    ++sequence; pause(); clearPlayer(); $('youtube-load').disabled = false;
    $('youtube-preview').hidden = true; status('');
    $('youtube-imported').hidden = true;
  });
  start.addEventListener('input', updateRange); end.addEventListener('input', updateRange);
  $('youtube-mark-start').onclick = () => { if (!isReady) return; start.value = player.getCurrentTime().toFixed(1); updateRange(); };
  $('youtube-mark-end').onclick = () => { if (!isReady) return; end.value = player.getCurrentTime().toFixed(1); updateRange(); };
  $('youtube-pause').onclick = pause;
  $('youtube-play-range').onclick = () => {
    try {
      if (!isReady) throw Error('Carregue a prévia primeiro.');
      const range = selection();
      if (range.id !== loadedId) throw Error('Carregue o novo link antes de ouvir.');
      $('youtube-imported-audio').pause();
      player.loadVideoById({ videoId: loadedId, startSeconds: range.start, endSeconds: range.end });
      segment = range;
      status('Reproduzindo trecho selecionado.');
    } catch (error) { status(error.message); }
  };
  dialog.addEventListener('close', () => { ++sequence; pause(); clearPlayer(); $('youtube-load').disabled = false; $('youtube-preview').hidden = true; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') pause(); });
  $('youtube-imported-audio').addEventListener('play', () => { segment = null; if (isReady) player.pauseVideo(); });
  updateRange();
  return {
    selection, pause,
    imported(audioUrl, range, name) {
      $('youtube-imported').hidden = false;
      $('youtube-imported-audio').src = audioUrl;
      $('youtube-imported-label').textContent = `${name || 'Trecho importado'} · ${timestamp(range.start)} → ${timestamp(range.end)}`;
    }
  };
}
