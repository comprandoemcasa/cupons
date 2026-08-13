const puppeteer = require("puppeteer");
const fs = require("fs");

async function extrair() {
  console.log("Iniciando navegador para captação total de cupons...");
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

    console.log("Acessando a página...");
    await page.goto("https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // Aguarda os elementos carregarem na tela
    await new Promise(r => setTimeout(r, 4000));

    // Extrai todos os blocos de cupons da tela
    const cupons = await page.evaluate(() => {
      const lista = [];
      const elementos = document.querySelectorAll("div, article, section");

      elementos.forEach(el => {
        const text = el.innerText || "";
        
        // Identifica se o bloco possui a estrutura de um cupom válido
        if (text.includes("DESCONTO") && text.includes("COMPRA MÍNIMA")) {
          const linhas = text.split("\n").map(l => l.trim()).filter(Boolean);
          
          let code = "";
          for (let linha of linhas) {
            // Procura por códigos em maiúsculo (entre 4 e 25 caracteres)
            if (/^[A-Z0-9_-]{4,25}$/.test(linha) && !["DESCONTO", "PERÍODO", "LISTA", "COMPRA", "OUTROS", "DESTAQUE", "MÁXIMO"].includes(linha)) {
              code = linha;
              break;
            }
          }

          if (code) {
            // Extração de Desconto
            let discount = "10% OFF";
            const descMatch = text.match(/(\d+(?:,\d+)?%\s*OFF|\d+(?:,\d+)?%|R\$\s*\d+[\s\S]*?OFF)/i);
            if (descMatch) {
              discount = descMatch[1].replace(/\s+/g, ' ').trim();
              if (!discount.includes("OFF") && !discount.includes("%")) discount += "% OFF";
              else if (!discount.includes("OFF")) discount += " OFF";
            }

            // Compra Mínima
            let min_purchase = "R$ 129";
            const minMatch = text.match(/COMPRA MÍNIMA[\s\S]*?(R\$\s*\d+|\d+)/i);
            if (minMatch) {
              min_purchase = minMatch[1].trim();
              if (!min_purchase.startsWith("R$")) min_purchase = "R$ " + min_purchase;
            }

            // Desconto Máximo
            let max_discount = "R$ 150";
            const maxMatch = text.match(/DESCONTO MÁX\.?[\s\S]*?(R\$\s*\d+|\d+)/i);
            if (maxMatch) {
              max_discount = maxMatch[1].trim();
              if (!max_discount.startsWith("R$")) max_discount = "R$ " + max_discount;
            }

            if (!lista.some(c => c.code === code)) {
              lista.push({
                code: code,
                discount: discount,
                min_purchase: min_purchase,
                max_discount: max_discount
              });
            }
          }
        }
      });

      return lista;
    });

    console.log(`Total de cupons encontrados dinamicamente: ${cupons.length}`);
    console.log(cupons);

    let resultadoFinal = cupons;

    // Fallback de segurança caso venha vazio
    if (resultadoFinal.length === 0) {
      resultadoFinal = [
        { code: "TECHEMCASA", discount: "10% OFF", min_purchase: "R$ 129", max_discount: "R$ 150" },
        { code: "COMPRINHASPRACASA", discount: "25% OFF", min_purchase: "R$ 19", max_discount: "R$ 150" }
      ];
    }

    fs.writeFileSync("data.json", JSON.stringify(resultadoFinal, null, 2));
    console.log("data.json atualizado com todos os cupons!");

  } catch (err) {
    console.error("Erro na extração:", err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

extrair();
