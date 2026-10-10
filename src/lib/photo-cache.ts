const pronto = new Map<string, string>();
const emCurso = new Map<string, Promise<string>>();
const retidas: HTMLImageElement[] = [];

export function fotoPronta(src?: string | null) {
  if (!src) return "";
  return pronto.get(src) || "";
}

export function guardarFoto(src: string): Promise<string> {
  if (!src) return Promise.resolve("");
  const ja = pronto.get(src);
  if (ja) return Promise.resolve(ja);
  const andamento = emCurso.get(src);
  if (andamento) return andamento;
  const tarefa = fetch(src)
    .then((res) => {
      if (!res.ok) throw new Error("foto");
      return res.blob();
    })
    .then(async (blob) => {
      const url = URL.createObjectURL(blob);
      pronto.set(src, url);
      const imagem = new Image();
      imagem.decoding = "async";
      imagem.src = url;
      try {
        await imagem.decode();
      } catch {
        /* a próxima tela ainda usa o arquivo já baixado */
      }
      retidas.push(imagem);
      return url;
    })
    .catch(() => src);
  emCurso.set(src, tarefa);
  return tarefa;
}

export function aquecerFotos(urls: string[]) {
  const fila = [...new Set(urls.filter(Boolean))];
  let indice = 0;
  const andar = async () => {
    while (indice < fila.length) {
      const src = fila[indice++];
      await guardarFoto(src);
    }
  };
  for (let n = 0; n < 4; n++) void andar();
}
