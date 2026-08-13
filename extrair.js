const puppeteer = require("puppeteer");
const fs = require("fs");

async function extrair() {
  console.log("Iniciando navegador dinâmico...");
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    
    // Define viewport e User-Agent real
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    console.log("Navegando até a página de cupons...");
    await page.goto("https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // Espera os elementos renderizarem na tela
    await page.waitForTimeout(3000);

    // Extrai todos os cards diretamente da árvore DOM renderizada
    const cupons = await page.evaluate(() => {
      const lista = [];
      
      // Busca todos os blocos de cupons na página
      const cards = document.querySelectorAll("div, article, section");

      cards.forEach(card => {
        const text = card.innerText || "";
        
        // Verifica se o bloco contém os indicativos de um card de cupom
        if (text.includes("DESCONTO") && text.includes("COMPRA MÍNIMA") && text.includes("DESCONTO MÁX")) {
          
          // Extrai linhas do card
          const linhas = text.split("\n").map(l => l.trim()).filter(Boolean);
          
          let code = "";
          let category = "MERCADO LIVRE";
          let discount = "";
          let min_purchase = "";
          let max_discount = "";

          // Pega o código do cupom (primeira palavra em caixa alta com > 4 chars)
          for (let item of linhas) {
            if (/^[A-Z0-9_-]{4,25}$/.test(item) && !["DESCONTO", "PERÍODO", "LISTA", "COMPRA", "OUTROS", "DESTAQUE"].includes(item)) {
              code = item;
              break;
            }
          }

          // Categoria (se houver tag como CASA E DECORAÇÃO, OUTROS, etc.)
          const catMatch = text.match(/(OUTROS|CASA E DECORAÇÃO|ELETRÔNICOS|MODA|BELEZA|ESPORTES)/i);
          if (catMatch) category = catMatch[1].toUpperCase();

          // Porcentagem / Desconto
          const descMatch = text.match(/(\d+(?:,\d+)?%\s*OFF|\d+(?:,\d+)?%|R\$\s*\d+[\s\S]*?OFF)/i);
          if (descMatch) {
            discount = descMatch[1].replace(/\s+/g, ' ').trim();
            if (!discount.includes("OFF")) discount += " OFF";
          }

          // Compra Mínima
          const minMatch = text.match(/COMPRA MÍNIMA[\s\S]*?(R\$\s*\d+|\d+)/i);
          if (minMatch) {
            min_purchase = minMatch[1].trim();
            if (!min_purchase.startsWith("R$")) min_purchase = "R$" + min_purchase;
          }

          // Desconto Máximo
          const maxMatch = text.match(/DESCONTO MÁX\.?[\s\S]*?(R\$\s*\d+|\d+)/i);
          if (maxMatch) {
            max_discount = maxMatch[1].trim();
            if (!max_discount.startsWith("R$")) max_discount = "R$" + max_discount;
          }

          if (code && !lista.some(c => c.code === code)) {
            lista.push({
              code: code,
              discount: discount || "Desconto Especial",
              category: category,
              min_purchase: min_purchase || "Sem Mínimo",
              max_discount: max_discount || "Sem Limite"
            });
          }
        }
      });

      return lista;
    });

    console.log(`Total de ${cupons.length} cupons encontrados dinamicamente:`);
    console.log(cupons);

    if (cupons.length > 0) {
      fs.writeFileSync("data.json", JSON.stringify(cupons, null, 2));
      console.log("data.json gravado com sucesso!");
    } else {
      console.log("Nenhum cupom foi identificado na renderização.");
    }

  } catch (err) {
    console.error("Erro durante a raspagem:", err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

extrair();
