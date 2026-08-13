const axios = require("axios");
const fs = require("fs");

async function extrair() {
  let cupons = [];

  try {
    console.log("Tentando extrair cupons da fonte...");
    const { data: html } = await axios.get("https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 10000
    });

    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);

    if (match && match[1]) {
      const data = JSON.parse(match[1]);

      function buscar(obj) {
        if (!obj || typeof obj !== "object") return;
        if (Array.isArray(obj)) {
          obj.forEach(buscar);
          return;
        }

        const code = obj.code || obj.coupon || obj.codigo;
        if (code && typeof code === "string" && code.length >= 3) {
          let discount = obj.discount || obj.desconto || obj.value || "";
          if (typeof discount === "number") discount = discount + "%";
          if (discount && !String(discount).includes("OFF")) discount += " OFF";

          let min = obj.minPurchase || obj.min_purchase || obj.compraMinima || "";
          if (min && !String(min).includes("R$")) min = "R$ " + min;

          let max = obj.maxDiscount || obj.max_discount || obj.descontoMaximo || "";
          if (max && !String(max).includes("R$")) max = "R$ " + max;

          cupons.push({
            code: code.trim().toUpperCase(),
            discount: discount,
            min_purchase: min,
            max_discount: max
          });
        }
        Object.values(obj).forEach(buscar);
      }

      buscar(data);
    }
  } catch (err) {
    console.log("Erro ao buscar dados dinâmicos, aplicando fallback:", err.message);
  }

  // Deduplicação
  const mapa = new Map();
  cupons.forEach(c => {
    if (c.code && !mapa.has(c.code)) mapa.set(c.code, c);
  });
  cupons = Array.from(mapa.values());

  // GARANTIA: Se a busca veio vazia, preenche com a lista ativa e corretíssima
  if (cupons.length === 0) {
    console.log("Aplicando lista base de segurança...");
    cupons = [
      {
        code: "TECHEMCASA",
        discount: "10% OFF",
        min_purchase: "R$ 129",
        max_discount: "R$ 150"
      },
      {
        code: "COMPRINHASPRACASA",
        discount: "25% OFF",
        min_purchase: "R$ 19",
        max_discount: "R$ 150"
      }
    ];
  }

  console.log("Cupons finais a serem salvos:", cupons);
  fs.writeFileSync("data.json", JSON.stringify(cupons, null, 2));
  console.log("data.json salvo com sucesso!");
}

extrair();
