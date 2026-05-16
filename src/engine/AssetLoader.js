export async function loadAssets({ images = {}, json = {} } = {}) {
  const out = { images: {}, json: {} };

  const imgTasks = Object.entries(images).map(([k, url]) => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => { out.images[k] = i; res(); };
    i.onerror = () => rej(new Error(`圖片載入失敗: ${url}`));
    i.src = url;
  }));

  const jsonTasks = Object.entries(json).map(([k, url]) =>
    fetch(url).then((r) => {
      if (!r.ok) throw new Error(`JSON 載入失敗: ${url} (${r.status})`);
      return r.json();
    }).then((j) => { out.json[k] = j; }));

  await Promise.all([...imgTasks, ...jsonTasks]);
  return out;
}
