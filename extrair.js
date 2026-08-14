const puppeteer = require("puppeteer");
const fs = require("fs");

async function extrair() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox"]
    });

    try {
        const page = await browser.newPage();

        await page.goto(
            "https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/",
            {
                waitUntil: "networkidle0"
            }
        );

        /*
         * Localiza os dados completos dos cupons dentro
         * do código publicado pelo Mercado Livre.
         */
        const scriptCupons = await page.$$eval(
            "script",
            scripts => {
                const script = scripts.find(item =>
                    item.textContent.includes("const COUPONS")
                );

                return script ? script.textContent : "";
            }
        );

        const match = scriptCupons.match(
            /const\s+COUPONS\s*=\s*(\[[\s\S]*?\]);/
        );

        if (!match) {
            throw new Error(
                "A lista de cupons não foi encontrada na página do Mercado Livre."
            );
        }

        const dadosOriginais = JSON.parse(match[1]);

        const cupons = dadosOriginais.map(item => ({
            code: item.nome,
            discount: item.valor_desconto,
            min_purchase: item.min_compra,
            max_discount: item.desconto_max,
            start_date: item.dia_inicio,
            end_date: item.dia_fim,
            category: item.acao,
            product_list_url: item.container_url || "",
            open_sitewide: Boolean(item.is_mar_aberto)
        }));

        /*
         * Esta proteção impede que um erro temporário
         * apague todos os cupons que já estavam publicados.
         */
        if (cupons.length === 0) {
            throw new Error(
                "O Mercado Livre retornou uma lista vazia de cupons."
            );
        }

        fs.writeFileSync(
            "data.json",
            JSON.stringify(cupons, null, 2)
        );

        console.log(
            "Cupons atualizados com sucesso:",
            cupons.length
        );
    } catch (erro) {
        console.error(
            "Não foi possível atualizar os cupons:",
            erro
        );

        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

extrair();
