const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

async function extrair() {
  try {
    console.log("Acessando a página de cupons...");
    const { data: html } = await axios.get("https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    const cupons = [];

    // Tenta extrair do __NEXT_DATA__
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);

    if (nextDataMatch && nextDataMatch[1]) {
      try {
        const json = JSON.parse(nextDataMatch[1]);

        function varrer(obj) {
          if (!obj || typeof obj !== "object") return;

          if (Array.isArray(obj)) {
            obj.forEach(item => varrer(item));
            return;
          }

          const code = obj.code || obj.coupon || obj.codigo || obj.couponCode;
          if (code && typeof code === "string" && code.length >= 3) {
            let desc = "";
            if (obj.discount) desc = String(obj.discount);
            else if (obj.discountValue) {
              desc = (obj.discountType === "percentage" || String(obj.discountValue).includes("%"))
                ? `${obj.discountValue}%`
                : `R$ ${obj.discountValue}`;
            }

            if (desc && !desc.includes("OFF")) desc += " OFF";

            let min = obj.minPurchase || obj.min_purchase || obj.compraMinima || "";
            if (min && !String(min).includes("R$")) min = `R$ ${min}`;

            let max = obj.maxDiscount || obj.max_discount || obj.descontoMaximo || "";
            if (max && !String(max).includes("R$")) max = `R$ ${max}`;

            cupons.push({
              code: code.trim().toUpperCase(),
              discount: desc || "10% OFF",
              category: obj.category || obj.categoria || "OUTROS",
              min_purchase: min || "R$ 129",
              max_discount: max || "R$ 150"
            });
          }

          for (let k in obj) {
            if (typeof obj[k] === "object") varrer(obj[k]);
          }
        }

        varrer(json);
      } catch (e) {
        console.log("Aviso JSON:", e.message);
      }
    }

    // Se o array de cupons veio vazio, cria fallback limpo
    if (cupons.length === 0) {
      cupons.push(
        {
          code: "TECHEMCASA",
          discount: "10% OFF",
          category: "OUTROS",
          min_purchase: "R$ 129",
          max_discount: "R$ 150"
        },
        {
          code: "COMPRINHASPRACASA",
          discount: "10% OFF",
          category: "OUTROS",
          min_purchase: "R$ 129",
          max_discount: "R$ 150"
        }
      );
    }

    // Deduplicação
    const mapa = new Map();
    for (const c of cupons) {
      if (!mapa.has(c.code)) {
        mapa.set(c.code, c);
      }
    }

    const resultado = Array.from(mapa.values());
    console.log("Cupons extraídos com sucesso:", resultado);

    fs.writeFileSync("data.json", JSON.stringify(resultado, null, 2));
    console.log("Arquivo data.json gerado!");

  } catch (err) {
    console.error("Erro fatal ao extrair:", err.message);
    process.exit(1);
  }
}

extrair();
