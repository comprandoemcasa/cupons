const axios = require("axios");
const fs = require("fs");

async function extrair() {
  try {
    console.log("Buscando cupons reais diretamente da API do Mercado Livre Afiliados...");

    // 1. Faz a requisição na API interna em JSON da própria fonte
    const urlApi = "https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/data/cupons.json";
    
    let cuponsBrutos = [];
    
    try {
      const res = await axios.get(urlApi + "?t=" + Date.now(), {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
      });
      if (Array.isArray(res.data)) {
        cuponsBrutos = res.data;
      }
    } catch (e) {
      console.log("Tentando endpoint secundário...");
    }

    // 2. Se a API direta não responder, faz o download do HTML e pega o objeto JSON cru no NextJS
    if (cuponsBrutos.length === 0) {
      const { data: html } = await axios.get("https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/", {
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      const jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
      if (jsonMatch && jsonMatch[1]) {
        const parsed = JSON.parse(jsonMatch[1]);
        
        // Função para achar arrays de cupons em qualquer profundidade
        function extrairArrays(obj) {
          if (!obj) return;
          if (Array.isArray(obj)) {
            if (obj.length > 0 && obj[0].code) {
              cuponsBrutos.push(...obj);
            } else {
              obj.forEach(extrairArrays);
            }
          } else if (typeof obj === "object") {
            Object.values(obj).forEach(extrairArrays);
          }
        }
        extrairArrays(parsed);
      }
    }

    console.log(`Total de cupons brutos encontrados: ${cuponsBrutos.length}`);

    // 3. Mapeamento e formatação precisa de cada campo
    const cuponsTratados = cuponsBrutos.map(item => {
      // Código do cupom
      const code = (item.code || item.codigo || item.coupon || "").toString().trim().toUpperCase();

      // Porcentagem ou Valor de Desconto
      let discount = "";
      if (item.discount) discount = String(item.discount);
      else if (item.desconto) discount = String(item.desconto);
      else if (item.discountValue) {
        discount = (item.discountType === "percentage" || String(item.discountValue).includes("%"))
          ? `${item.discountValue}%`
          : `R$ ${item.discountValue}`;
      } else if (item.value) discount = String(item.value);

      if (discount && !discount.includes("OFF") && !discount.includes("%")) discount += "% OFF";
      else if (discount && !discount.includes("OFF")) discount += " OFF";

      // Compra Mínima
      let min_purchase = item.minPurchase || item.min_purchase || item.compraMinima || item.min || "Sem Mínimo";
      if (min_purchase !== "Sem Mínimo" && !String(min_purchase).includes("R$")) {
        min_purchase = `R$ ${min_purchase}`;
      }

      // Desconto Máximo
      let max_discount = item.maxDiscount || item.max_discount || item.descontoMaximo || item.max || "Sem Limite";
      if (max_discount !== "Sem Limite" && !String(max_discount).includes("R$")) {
        max_discount = `R$ ${max_discount}`;
      }

      // Categoria
      const category = (item.category || item.categoria || "MERCADO LIVRE").toUpperCase();

      return {
        code,
        discount: discount || "Desconto Especial",
        category,
        min_purchase,
        max_discount
      };
    }).filter(c => c.code.length >= 3);

    // Deduplicação
    const mapa = new Map();
    for (const c of cuponsTratados) {
      if (!mapa.has(c.code)) mapa.set(c.code, c);
    }

    const resultadoFinal = Array.from(mapa.values());

    console.log("Cupons Finais Processados:", resultadoFinal);

    fs.writeFileSync("data.json", JSON.stringify(resultadoFinal, null, 2));
    console.log("data.json gravado com sucesso!");

  } catch (err) {
    console.error("Erro na integração:", err.message);
    process.exit(1);
  }
}

extrair();
