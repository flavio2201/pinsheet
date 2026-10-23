/** @type {import('next').NextConfig} */
const nextConfig = {
  // Site 100% estático: tudo roda no navegador, nenhuma imagem é enviada a servidor.
  output: "export",
  // Só afeta o `npm run dev`: permite abrir pelo IP da rede (ex.: celular no mesmo Wi-Fi).
  allowedDevOrigins: ["192.168.*.*"],
};
export default nextConfig;
