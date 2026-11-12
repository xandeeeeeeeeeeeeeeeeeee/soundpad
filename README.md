# Soundpad — SMK-25

Aplicativo local para Windows, com áudio pré-carregado e mapeamento MIDI.

## Executável Windows

Baixe **Soundpad-1.1.0-win-x64.exe** na seção Releases deste repositório. Execute o arquivo para abrir o aplicativo no navegador padrão. Recomenda-se Chrome ou Edge para MIDI. Requer Windows 10/11 de 64 bits; não precisa instalar Node.js, FFmpeg ou yt-dlp separadamente.

O aplicativo fica na bandeja do Windows: use **Abrir Soundpad**, **Abrir pasta de dados** ou **Encerrar Soundpad**. Fechar a aba não encerra o servidor. Na primeira execução, o runtime é extraído em `%LOCALAPPDATA%/Soundpad/runtime/`. Áudios e configurações ficam em `%LOCALAPPDATA%/Soundpad/data/` e permanecem separados das versões do programa.

O executável não tem assinatura digital. A release inclui `SHA256SUMS.txt` para verificar a integridade. Dados de usuário não são incluídos. Para transferir o setup da versão de desenvolvimento, exporte o backup nela e restaure-o na versão executável.

## Desenvolvimento

Requer Node.js 22+. Para instalar as ferramentas de mídia: `npm run setup:media`.

## Abrir

Execute `iniciar.cmd` ou `npm start` e abra http://127.0.0.1:3210. Clique em **Ativar áudio**. Para o teclado, conecte por USB, clique em **Conectar SMK-25** e use **Controlador MIDI → Aprender** para cada controle.

## Loja de sons

A loja consulta **Wikimedia Commons** e **Internet Archive** em tempo real, sem chave de API. Os resultados mostram arquivo, origem, autor, licença e link da fonte.

- **Ouvir:** baixa o áudio, converte quando necessário e reproduz até 15 segundos. **Parar prévia** interrompe a reprodução.
- **Adicionar:** salva o arquivo na biblioteca local, com atribuição e licença incluídas no backup. Uma prévia já carregada é reutilizada.
- Filtro por fonte, paginação e atalhos para termos frequentes. Termos comuns em português são traduzidos para melhorar a busca.
- Internet Archive: busca títulos de áudio com licença Creative Commons declarada e seleciona um arquivo por item. Wikimedia: busca arquivos de áudio com metadados de licença.
- Limite de download pela loja: 32 MB por arquivo. Resultados maiores ficam de fora. A disponibilidade e a qualidade dos metadados dependem da fonte.

Não há sons procedurais incluídos nem sintetizador. A migração remove os sons antigos e suas atribuições, preservando arquivos importados e mapeamentos MIDI. Backups antigos passam pela mesma limpeza ao serem restaurados. Outros acervos, como Freesound e Pixabay, não têm integração direta nesta versão.

APIs utilizadas: https://www.mediawiki.org/wiki/API:Imageinfo e https://archive.org/services/docs/api/.

O botão **Modo escuro / Modo claro** no cabeçalho alterna o tema. A preferência fica salva neste navegador e é aplicada antes de a interface carregar.

Na **Biblioteca**, use **Renomear** para alterar o nome de qualquer som, incluindo arquivos locais, recortes do YouTube e downloads da loja. Pads/teclas que ainda usam o nome anterior são atualizados; nomes personalizados dos controles são preservados.

## Controles

- 25 teclas, dois bancos de oito pads, dois bancos de oito knobs, pitch, modulação e ações de transporte/pedal.
- Nome, cor, volume, panorama, cortes, fade-in, loop, disparo único, liga/desliga e enquanto pressionado.
- Cenas com camadas sincronizadas; grupos exclusivos para substituir sons; volumes por categoria e ducking opcional.
- Volume individual das vozes, limitador master, fade-out e parada global.
- `1–8`: pads do banco ativo. `Esc`: parar tudo. `Shift + clique`: editar pad/tecla.

Mapeamentos são aplicados no aplicativo. Exportação de mapa MIDI é uma referência JSON, não um preset CubeSuite. Gravação no hardware e sincronização de LEDs não são suportadas. Encoders usam CC absoluto; bancos físicos podem precisar de aprendizado específico.

## Prévia e recorte do YouTube

Em **Importar som**, cole o link e clique em **Carregar prévia**. O player oficial permite navegar no vídeo. Use **Marcar início** e **Marcar fim** para copiar a posição atual, ou ajuste os campos em segundos (precisão de 0,1 s). **Ouvir trecho** reproduz a seleção; **Pausar** interrompe. Fechar a janela também interrompe o player.

O campo **Nome do recorte** define o nome do áudio na biblioteca. Se estiver vazio, é usado um nome automático com os tempos do trecho.

**Recortar e importar** usa os mesmos limites e salva o resultado na biblioteca. Um player de áudio aparece para conferir o arquivo recortado. A prévia é um stream do YouTube e seus pontos de busca podem depender dos keyframes; o arquivo local é produzido pelo importador. Vídeos privados, bloqueados para incorporação ou indisponíveis podem impedir a prévia. Nenhuma chave de API é necessária.

## Importação e armazenamento

`npm run setup:media` instala yt-dlp e FFmpeg localmente. Áudio/vídeo até 150 MB; recortes do YouTube até 600 segundos. Downloads do YouTube dependem da disponibilidade do serviço e não contornam autenticação. Formatos: WAV, MP3, OGG, FLAC, M4A, AAC, AIFF, OPUS, WEBM, MP4 e WMA. Sem FFmpeg, a decodificação depende do navegador.

Configurações em `data/setup.json`, áudio em `data/audio/`. Exportar setup inclui áudio e metadados de origem. Após a importação, os arquivos funcionam offline. A loja e o YouTube precisam de internet. A interface usa fontes locais.

O servidor escuta apenas em `127.0.0.1:3210`. Todos os sons da biblioteca são decodificados na RAM. A latência depende do driver e da saída. A seleção de saída depende do suporte do navegador.

## Testes

`npm test`: migração, restrições dos downloads, busca, reprodução agendada, loops, fades, grupos exclusivos, recortes e restrições HTTP. A loja também foi validada com consultas e download reais. Hardware MIDI precisa de validação com o aparelho.

## Compilar o executável

No Windows x64, execute `npm run setup:media`, `npm test` e `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-windows.ps1`. O build usa o compilador .NET Framework do Windows e o Node.js instalado. Gera o executável e o SHA-256 em `release/`. `SOUNDPAD_HOME` permite usar uma pasta alternativa para runtime/dados; `Soundpad-1.1.0-win-x64.exe --self-test` testa o pacote sem abrir o navegador (encerre outras instâncias antes).

## Mixer e controles MIDI

- Em **Mixer**, crie ou renomeie canais de áudio e categorias. Cada um tem volume, mute, solo, panorama, filtro e tom/velocidade. Categorias podem participar do ducking. Itens em uso não podem ser removidos.
- Em **Biblioteca → Editar som**, defina categoria, canal e ajustes do próprio som. O canal é um subgrupo de áudio interno, não uma saída física nem um canal MIDI.
- Em **Configurar** abaixo de cada knob, escolha master, canal, categoria, som ou pad/tecla; depois volume, panorama, filtro, tom/velocidade ou mute. Ajuste mínimo, máximo, curva, inversão e modo absoluto/relativo. No SMK-25 use absoluto, salvo configuração diferente no hardware. Os bancos de knobs e pads são independentes.
- Em **Controlador MIDI → Editar MIDI**, configure mensagem, número e canal MIDI (0 aceita todos). Para pads/teclas, este editor também permite substituir o canal de áudio do som. Aprender continua disponível.
- Notas repetidas são ignoradas até a soltura, inclusive mensagens duplicadas como `note 62` duas vezes. CC usado como botão dispara só na transição de zero para um valor positivo. Movimentos contínuos de knobs continuam funcionando. Reconectar remove os listeners da conexão anterior.
- Mapeamentos sobrepostos são sinalizados. Se dois pads/teclas usam a mesma mensagem, só o primeiro atribuído do banco ativo dispara; para tocar sons juntos, use uma cena. Soltar uma tecla encerra o modo hold mesmo após trocar de banco.
- Ajustes de mixer afetam vozes em reprodução e ficam no setup/backup. Mudança de tom altera também velocidade e duração (não há time-stretch).
