# Folha de botons

Site para montar folhas de botons (pins): envie as imagens, ajuste cada uma no círculo e baixe um PDF no tamanho exato para imprimir e cortar.

Tudo roda no navegador. Nenhuma imagem é enviada para servidor.

## Rodar no computador

```bash
npm install
npm run dev
```

Abra http://localhost:3000

## Publicar

O projeto está configurado como site estático (`output: "export"`).

- **Vercel:** importe a pasta/repositório e clique em Deploy. Nada a configurar.
- **Qualquer hospedagem (Netlify, cPanel, S3, etc.):** rode `npm run build` e envie o conteúdo da pasta `out/`.

## Ajustes rápidos

- Tamanhos de botom: `PRESETS` em `components/BadgeSheet.tsx`
- Margem da folha e espaço entre círculos: parâmetros `margin` e `gap` em `lib/layout.ts`
- Resolução do PDF: `DPI` em `lib/pdf.ts` (padrão 300)
