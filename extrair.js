const axios = require("axios");
const fs = require("fs");

async function extrair() {
  try {
    console.log("Buscando cupons direto da API/fonte...");
    
    // Altere para a URL exata do arquivo JSON ou da fonte de dados se houver, 
    // ou faça o parse direto da página de dados deles:
    const urlFonte = "https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/data.json"; 
    
    const { data } = await axios.get(urlFonte, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 10000
    });

    if (Array.isArray(data) && data.length > 0) {
      console.log(`Sucesso! ${data.length} cupons encontrados.`);
      fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
    } else {
      throw new Error("Dados vazios retornados da fonte.");
    }

  } catch (err) {
    console.error("Erro ao puxar automático:", err.message);
    
    // Mantém os dados anteriores caso ocorra alguma instabilidade temporária na fonte
    if (!fs.existsSync("data.json")) {
      const fallback = [
        { code: "TECHEMCASA", discount: "10% OFF", min_purchase: "R$ 129", max_discount: "R$ 150" },
        { code: "COMPRINHASPRACASA", discount: "25% OFF", min_purchase: "R$ 19", max_discount: "R$ 150" }
      ];
      fs.writeFileSync("data.json", JSON.stringify(fallback, null, 2));
    }
  }
}

extrair();
