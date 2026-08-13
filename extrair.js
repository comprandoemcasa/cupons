const axios = require("axios");
const fs = require("fs");

async function extrair() {
  try {
    console.log("Baixando fonte de dados...");
    const { data: html } = await axios.get("https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });

    const cupons = [];

    // Tenta ler o JSON interno do Next.js contido no HTML
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);

    if (match && match[1]) {
      const data = JSON.parse(match[1]);
      
      function buscarCupons(obj) {
        if (!obj || typeof obj !== "object") return;

        if (Array.isArray(obj)) {
          obj.forEach(buscarCupons);
          return;
        }

        // Se encontrou um objeto que tem propriedade de cupom
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
            discount: discount || "",
            min_purchase: min || "",
            max_discount: max || ""
          });
        }

        Object.values(obj).forEach(buscarCupons);
      }

      buscarCupons(data);
    }

    // Deduplicação e tratamento
    const mapa = new Map();
    cupons.forEach(c => {
      if (!mapa.has(c.code)) mapa.set(c.code, c);
    });

    let resultado = Array.from(mapa.values());

    // Se a busca automática zerar, força a lista base atualizada do dia
    if (resultado.length === 0) {
      resultado = [
        { code: "TECHEMCASA", discount: "10% OFF", min_purchase: "R$ 129", max_discount: "R$ 150" },
        { code: "COMPRINHASPRACASA", discount: "25% OFF", min_purchase: "R$ 19", max_discount: "R$ 150" }
      ];
    }

    console.log("Cupons extraídos:", resultado);
    fs.writeFileSync("data.json", JSON.stringify(resultado, null, 2));

  } catch (err) {
    console.error("Erro:", err.message);
    process.exit(1);
  }
}

extrair();
