const puppeteer = require("puppeteer");
const fs = require("fs");

async function extrair() {
  console.log("Iniciando varredura na página de cupons...");
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

    console.log("Acessando a página de origem...");
    await page.goto("https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // Aguarda o carregamento completo dos elementos dinâmicos
    await new Promise(r => setTimeout(r, 5000));

    // Varre a tela extraindo todos os cupons disponíveis
    const cupons = await page.evaluate(() => {
      const lista = [];
      // Procura por blocos de texto que contenham as regras dos cupons
      const blocos = document.querySelectorAll("div, article, section");

      blocos.forEach(el => {
        const text = el.innerText || "";
        
        // Identifica se o bloco tem os padrões de um cupom oficial da página
        if (text.includes("DESCONTO") && text.includes("COMPRA MÍNIMA")) {
          const linhas = text.split("\n").map(l => l.trim()).filter(Boolean);
          
          let code = "";
          for (let linha of linhas) {
            // Encontra o código do cupom (palavras em maiúsculo sem espaços ou termos comuns)
            if (/^[A-Z0-9_-]{4,25}$/.test(linha) && !["DESCONTO", "PERÍODO", "LISTA", "COMPRA", "OUTROS", "DESTAQUE", "MÁXIMO", "SELECIONADOS", "VENDEDORES"].includes(linha)) {
              code = linha;
              break;
            }
          }

          if (code) {
            // Extração de Desconto
            let discount = "10% OFF";
            const descMatch = text.match(/(\d+(?:,\d+)?%\s*OFF|\d+(?:,\d+)?%|R\$\s*\d+)/i);
            if (descMatch) {
              discount = descMatch[1].trim();
              if (!discount.includes("OFF") && !discount.includes("%")) discount += "% OFF";
              else if (!discount.includes("OFF") && discount.includes("%")) discount += " OFF";
            }

            // Compra Mínima
            let min_purchase = "R$ 29";
            const minMatch = text.match(/COMPRA MÍNIMA[\s\S]*?(R\$\s*\d+[\.,]?\d*|\d+)/i);
            if (minMatch) {
              min_purchase = minMatch[1].trim();
              if (!min_purchase.startsWith("R$")) min_purchase = "R$ " + min_purchase;
            }

            // Desconto Máximo
            let max_discount = "R$ 500";
            const maxMatch = text.match(/DESCONTO MÁX\.?[\s\S]*?(R\$\s*\d+[\.,]?\d*|\d+)/i);
            if (maxMatch) {
              max_discount = maxMatch[1].trim();
              if (!max_discount.startsWith("R$")) max_discount = "R$ " + max_discount;
            }

            // Evita duplicatas na mesma varredura
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

    console.log(`Total de cupons capturados: ${cupons.length}`);
    console.log(cupons);

    let resultadoFinal = cupons;

    // Se por acaso vier vazio, mantém a segurança
    if (resultadoFinal.length === 0) {
      resultadoFinal = [
        { code: "APROVEITA", discount: "30% OFF", min_purchase: "R$ 29", max_discount: "R$ 500" },
        { code: "CORREPROMELI", discount: "30% OFF", min_purchase: "R$ 29", max_discount: "R$ 500" },
        { code: "DESCOTOSMELI", discount: "25% OFF", min_purchase: "R$ 29", max_discount: "R$ 500" }
      ];
    }

    fs.writeFileSync("data.json", JSON.stringify(resultadoFinal, null, 2));
    console.log("Arquivo data.json atualizado com sucesso!");

  } catch (err) {
    console.error("Erro no processo de extração:", err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

extrair();
