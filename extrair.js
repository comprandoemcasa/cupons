const puppeteer = require("puppeteer");
const fs = require("fs");

async function extrair() {
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ["--no-sandbox"] 
  });

  try {
    const page = await browser.newPage();
    await page.goto("https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/", {
      waitUntil: "networkidle0" // Espera tudo carregar
    });

    // Vamos extrair a estrutura baseada em cards que o site usa
    const cupons = await page.evaluate(() => {
      const lista = [];
      // Esse seletor busca os blocos principais que contêm os cupons
      const cards = Array.from(document.querySelectorAll('div[class*="css-"], div[class*="card"]'));
      
      cards.forEach(card => {
        const text = card.innerText;
        // Filtra apenas blocos que parecem ter um código de cupom e desconto
        if (text && text.includes("OFF") && text.includes("R$")) {
          const lines = text.split('\n');
          // Tenta identificar o código (geralmente em destaque)
          const code = lines.find(l => /^[A-Z0-9]{4,}$/.test(l)) || "CUPOM";
          const discount = lines.find(l => l.includes("OFF")) || "10% OFF";
          const min = lines.find(l => l.includes("MÍNIMA")) || "R$ 0";
          const max = lines.find(l => l.includes("MÁX")) || "R$ 0";
          
          if (!lista.some(c => c.code === code)) {
            lista.push({ code, discount, min_purchase: min, max_discount: max });
          }
        }
      });
      return lista;
    });

    fs.writeFileSync("data.json", JSON.stringify(cupons, null, 2));
    console.log("Cupons extraídos:", cupons.length);
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}
extrair();
