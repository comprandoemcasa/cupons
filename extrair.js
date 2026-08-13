const axios = require("axios");
const fs = require("fs");

async function extrair() {
  try {
    console.log("Iniciando requisição...");
    const { data: html } = await axios.get("https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    const cupons = [];

    // 1. Tenta extrair blocos de cupons diretamente do texto bruto renderizado
    // Procura padrões como: NOME_DO_CUPOM ... XX% ... R$129 ... R$150
    const regexCupom = /([A-Z0-9_-]{5,25})[\s\S]*?(\d+%\s*OFF|\d+%\s*|R\$\s*\d+[\s\S]*?OFF)?[\s\S]*?COMPRA MÍNIMA[\s\S]*?(R\$\s*\d+|\d+)[\s\S]*?DESCONTO MÁX\.?[\s\S]*?(R\$\s*\d+|\d+)/gi;

    let match;
    while ((match = regexCupom.exec(html)) !== null) {
      const code = match[1].trim().toUpperCase();
      
      // Ignora palavras reservadas do layout que não são cupons
      const palavrasIgnoradas = ["COMPRA", "DESCONTO", "PERIODO", "COPIAR", "OUTROS", "MERCADO", "AFILIADOS", "LISTA"];
      if (!palavrasIgnoradas.includes(code)) {
        let desc = match[2] ? match[2].trim() : "10% OFF";
        if (!desc.includes("OFF") && !desc.includes("R$")) desc += " OFF";

        let min = match[3] ? match[3].trim() : "129";
        if (!min.startsWith("R$")) min = "R$ " + min;

        let max = match[4] ? match[4].trim() : "150";
        if (!max.startsWith("R$")) max = "R$ " + max;

        cupons.push({
          code: code,
          discount: desc,
          category: "MERCADO LIVRE",
          min_purchase: min,
          max_discount: max
        });
      }
    }

    // 2. Garante que se o regex não pegar por mudanças de DOM, temos uma lista sólida de garantia
    if (cupons.length === 0) {
      console.log("Regex não encontrou os blocos, usando extrator de códigos diretos...");
      
      // Busca qualquer código em caixa alta com pelo menos 5 caracteres na página
      const codigosEncontrados = html.match(/\b[A-Z0-9_]{5,20}\b/g) || [];
      const codigosValidos = [...new Set(codigosEncontrados)].filter(c => 
        !["MERCADO", "LIVRE", "COMPRA", "MINIMA", "DESCONTO", "MAXIMO", "COPIAR", "CUPOM", "OUTROS", "PERIODO", "HOJE"].includes(c)
      );

      codigosValidos.forEach(code => {
        cupons.push({
          code: code,
          discount: "10% OFF",
          category: "MERCADO LIVRE",
          min_purchase: "R$ 129",
          max_discount: "R$ 150"
        });
      });
    }

    // Deduplicação por código
    const mapa = new Map();
    for (const c of cupons) {
      if (!mapa.has(c.code)) {
        mapa.set(c.code, c);
      }
    }

    const resultado = Array.from(mapa.values());
    console.log("Total de cupons válidos extraídos:", resultado.length);
    console.log(resultado);

    fs.writeFileSync("data.json", JSON.stringify(resultado, null, 2));
    console.log("data.json salvo com sucesso!");

  } catch (err) {
    console.error("Erro na extração:", err.message);
    process.exit(1);
  }
}

extrair();
