# Componentes do executável Windows

O lançador inicia componentes independentes, sem modificar seus binários:

- **Node.js 24.12.0 (x64)** — licença MIT e avisos das dependências, incluídos em `licenses/Node-LICENSE.txt`. Código-fonte: https://nodejs.org/download/release/v24.12.0/node-v24.12.0.tar.xz
- **yt-dlp** — versão identificada por `tools/yt-dlp.exe --version`; licença e avisos incluídos em `licenses/yt-dlp-LICENSE.txt`. Código-fonte e licenças das dependências do executável: https://github.com/yt-dlp/yt-dlp e https://github.com/yt-dlp/yt-dlp/blob/master/THIRD_PARTY_LICENSES.txt
- **FFmpeg 6.1.1 essentials (Gyan build, distribuído por ffmpeg-static b6.1.1)** — GPL v3; licença e README originais incluídos em `licenses/FFmpeg-LICENSE.txt` e `licenses/FFmpeg-README.txt`. Fontes e informações de compilação: https://www.gyan.dev/ffmpeg/builds/ e https://github.com/FFmpeg/FFmpeg/tree/n6.1.1 ; distribuição usada: https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1

As licenças ficam na pasta de runtime extraída pelo executável em `%LOCALAPPDATA%/Soundpad/runtime/`. Áudios de terceiros não são distribuídos no pacote. Os metadados e licenças de sons importados da loja permanecem no backup do usuário.
