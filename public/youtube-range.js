export function youtubeVideoId(value) {
  let url;
  try { url = new URL(value.trim()); } catch { throw Error('Cole um link válido do YouTube.'); }
  if (url.protocol !== 'https:' || url.port || url.username || url.password ||
      !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) {
    throw Error('Use um link HTTPS do YouTube.');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const id = url.hostname === 'youtu.be' ? parts[0] :
    url.pathname === '/watch' ? url.searchParams.get('v') :
      ['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : null;
  if (!/^[A-Za-z0-9_-]{11}$/.test(id || '')) throw Error('O link não contém um vídeo válido.');
  return id;
}

export function youtubeRange(start, end, duration = 0) {
  if (String(start).trim() === '' || String(end).trim() === '') throw Error('Informe início e fim.');
  start = Number(start); end = Number(end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start)
    throw Error('O fim deve ser maior que o início.');
  if (end - start > 600) throw Error('Selecione um trecho de até 10 minutos.');
  if (duration > 0 && (start >= duration || end > duration + 0.1))
    throw Error('O trecho ultrapassa a duração do vídeo.');
  return { start, end };
}

export function timestamp(seconds) {
  seconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
}
