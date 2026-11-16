// PDF da cotação sem bibliotecas: a folha (já com campos em texto, fotos e estilos dentro) desenha-se num canvas através de um SVG com foreignObject,
// fica igual ao que se vê no ecrã, e as fatias A4 vão como imagens JPEG para um PDF escrito à mão. Devolve o PDF em base64.
// shortcut: o texto fica em imagem (não se selecciona) e a quebra de página corta onde calhar; passar a PDF com texto se o cliente precisar de copiar valores.
const A4 = { l: 595.28, a: 841.89, margem: 0 } // a margem já vem na própria folha (12 mm)
const ESCALA = 2

const bytesDe = (t: string) => new TextEncoder().encode(t)

const paraDataUri = (b: Blob) =>
  new Promise<string>((ok, falha) => {
    const l = new FileReader()
    l.onload = () => ok(String(l.result))
    l.onerror = () => falha(l.error)
    l.readAsDataURL(b)
  })

// uma imagem SVG não vai buscar ficheiros fora dela: os ficheiros do tipo de letra da folha (@font-face) entram no CSS como dados
async function fontesDentro(css: string, familia: string): Promise<string> {
  const blocos = Array.from(css.matchAll(/@font-face\s*{[^}]*}/g)).map((m) => m[0]).filter((b) => b.includes(familia))
  let saida = css
  for (const b of blocos) {
    let novo = b
    for (const m of b.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      try {
        const blob = await (await fetch(new URL(m[1], window.location.href).href)).blob()
        novo = novo.replace(m[1], await paraDataUri(blob))
      } catch {
        /* sem este ficheiro cai no tipo de letra seguinte */
      }
    }
    saida = saida.replace(b, novo)
  }
  return saida
}

export async function cotacaoParaPdf(copia: HTMLElement, css: string, largura: number, altura: number, fonte: string): Promise<string> {
  const familia = (fonte.split(',')[0] || '').replace(/["']/g, '').trim()
  css = (familia ? await fontesDentro(css, familia) : css) + `\n#${copia.id},#${copia.id} *{font-family:${fonte}!important}`
  const ns = 'http://www.w3.org/1999/xhtml'
  const raiz = document.createElementNS(ns, 'div') as HTMLElement
  const estilo = document.createElementNS(ns, 'style')
  estilo.textContent = css
  raiz.append(estilo, copia)
  copia.style.cssText += `;width:${largura}px;max-width:none;margin:0;border:0;box-shadow:none`
  const xhtml = new XMLSerializer().serializeToString(raiz)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}"><foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`
  const img = new Image()
  await new Promise<void>((ok, falha) => {
    img.onload = () => ok()
    img.onerror = () => falha(new Error('svg'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
  const tela = document.createElement('canvas')
  tela.width = largura * ESCALA
  tela.height = altura * ESCALA
  const c = tela.getContext('2d')!
  c.fillStyle = '#fff'
  c.fillRect(0, 0, tela.width, tela.height)
  // o tipo de letra posto no SVG só fica pronto depois do primeiro desenho: desenha-se, espera-se e volta a desenhar
  c.drawImage(img, 0, 0, tela.width, tela.height)
  await new Promise((r) => setTimeout(r, 400))
  c.fillRect(0, 0, tela.width, tela.height)
  c.drawImage(img, 0, 0, tela.width, tela.height)

  // fatias A4: cada página leva uma faixa da folha, à largura útil
  const cl = A4.l - 2 * A4.margem
  const ca = A4.a - 2 * A4.margem
  const fatiaPx = Math.floor((tela.width * ca) / cl)
  const paginas: { jpeg: Uint8Array; w: number; h: number; hPt: number }[] = []
  for (let y = 0; y < tela.height; y += fatiaPx) {
    const h = Math.min(fatiaPx, tela.height - y)
    if (y > 0 && h < 8) break // sobra de arredondamento: não faz página
    const parte = document.createElement('canvas')
    parte.width = tela.width
    parte.height = h
    const pc = parte.getContext('2d')!
    pc.fillStyle = '#fff'
    pc.fillRect(0, 0, parte.width, h)
    pc.drawImage(tela, 0, y, tela.width, h, 0, 0, tela.width, h)
    const b64 = parte.toDataURL('image/jpeg', 0.92).split(',')[1]
    const bin = atob(b64)
    const jpeg = Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
    paginas.push({ jpeg, w: tela.width, h, hPt: (h * cl) / tela.width })
  }

  // PDF: 1 catálogo, 2 páginas, depois (página, conteúdo, imagem) por fatia
  const partes: Uint8Array[] = [bytesDe(`%${'PDF'}-1.4\n`)]
  const pos: number[] = []
  let total = partes[0].length
  const obj = (n: number, ...cs: (string | Uint8Array)[]) => {
    pos[n] = total
    const lista = [bytesDe(`${n} 0 obj\n`), ...cs.map((x) => (typeof x === 'string' ? bytesDe(x) : x)), bytesDe('\nendobj\n')]
    for (const l of lista) {
      partes.push(l)
      total += l.length
    }
  }
  const n = paginas.length
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, `<< /Type /Pages /Count ${n} /Kids [${paginas.map((_, k) => `${3 + k * 3} 0 R`).join(' ')}] >>`)
  paginas.forEach((p, k) => {
    const id = 3 + k * 3
    const y = A4.a - A4.margem - p.hPt
    const conteudo = `q ${cl.toFixed(2)} 0 0 ${p.hPt.toFixed(2)} ${A4.margem} ${y.toFixed(2)} cm /Im0 Do Q`
    obj(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.l} ${A4.a}] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`)
    obj(id + 1, `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`)
    obj(id + 2, `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, '\nendstream')
  })
  const nObj = 3 + n * 3
  const xref = total
  let tabela = `xref\n0 ${nObj}\n0000000000 65535 f \n`
  for (let i = 1; i < nObj; i++) tabela += `${String(pos[i]).padStart(10, '0')} 00000 n \n`
  tabela += `trailer\n<< /Size ${nObj} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  partes.push(bytesDe(tabela))

  const todo = new Uint8Array(partes.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of partes) {
    todo.set(p, o)
    o += p.length
  }
  let bin = ''
  for (let i = 0; i < todo.length; i += 0x8000) bin += String.fromCharCode(...todo.subarray(i, i + 0x8000))
  return btoa(bin)
}
