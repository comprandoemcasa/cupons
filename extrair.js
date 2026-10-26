const puppeteer = require("puppeteer");
const fs = require("fs");

const URL_PRINCIPAIS =
  "https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/index.html";
const URL_EXTRAS =
  "https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/cupons-extras.html";

async function lerConstante(page, url, nome) {
  await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });

  const conteudo = await page.$$eval(
    "script",
    (scripts, nomeDaConstante) => {
      const script = scripts.find(item =>
        item.textContent.includes("const " + nomeDaConstante)
      );
      return script ? script.textContent : "";
    },
    nome
  );

  const expressao = new RegExp(
    "const\\s+" + nome + "\\s*=\\s*(\\[[\\s\\S]*?\\]);"
  );
  const resultado = conteudo.match(expressao);

  if (!resultado) {
    throw new Error("A lista " + nome + " não foi encontrada em " + url + ".");
  }

  return JSON.parse(resultado[1]);
}

function normalizarPercentual(valor, observacao) {
  const texto = String(valor || "").trim();

  if (texto.includes("%")) return texto;

  if (texto) {
    const numero = Number(texto.replace(".", "").replace(",", "."));
    if (numero > 0 && numero < 1) return Math.round(numero * 100) + "%";
  }

  const achado = String(observacao || "").match(/(\d+(?:[,.]\d+)?)\s*%/);
  return achado ? achado[1].replace(".", ",") + "%" : texto;
}

function normalizarDescontoPrincipal(item) {
  const texto = String(item.valor_desconto || "").trim();
  const numero = Number(
    texto.replace("%", "").replace(".", "").replace(",", ".")
  );

  if (texto.includes("%") && numero > 100) {
    return item.desconto_max ? "R$" + item.desconto_max : texto;
  }

  return texto;
}

function normalizarDescontoExtra(item) {
  if (String(item.mecanica || "").toLowerCase() === "fixo") {
    const valor = String(item.desconto || item.desconto_max || "")
      .trim()
      .replace(/^R\$\s*/, "");
    return valor ? "R$" + valor : "";
  }

  return normalizarPercentual(item.desconto, item.obs);
}

async function extrair() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"]
  });

  try {
    const page = await browser.newPage();
    const dadosPrincipais = await lerConstante(page, URL_PRINCIPAIS, "COUPONS");
    const dadosExtras = await lerConstante(page, URL_EXTRAS, "ITEMS");

    const coupons = dadosPrincipais.map(item => ({
      code: item.nome,
      discount: normalizarDescontoPrincipal(item),
      min_purchase: item.min_compra,
      max_discount: item.desconto_max,
      start_date: item.dia_inicio,
      end_date: item.dia_fim,
      category: item.acao,
      product_list_url: item.container_url || "",
      open_sitewide: Boolean(item.is_mar_aberto),
      coupon_type: "principal",
      has_code: true,
      note: ""
    }));

    const extraCoupons = dadosExtras.map(item => {
      const hasCode =
        String(item.tipo_cupom || "").toLowerCase() !== "cuponeria" &&
        Boolean(String(item.nome_cupom || "").trim());

      return {
        code: hasCode ? String(item.nome_cupom).trim() : "DESCONTO AUTOMÁTICO",
        discount: normalizarDescontoExtra(item),
        min_purchase: item.asp_minimo || "",
        max_discount: item.desconto_max || "",
        start_date: item.data_inicial || "",
        end_date: item.data_final || "",
        category: item.categoria || item.vertical || "Cupom extra",
        product_list_url: item.url || "",
        open_sitewide: false,
        coupon_type: "extra",
        has_code: hasCode,
        note: item.obs || ""
      };
    });

    if (coupons.length === 0) {
      throw new Error("O Mercado Livre retornou uma lista principal vazia.");
    }

    const updatedAt = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date()).replace(",", "");

    fs.writeFileSync(
      "data.json",
      JSON.stringify(
        { updated_at: updatedAt, coupons, extra_coupons: extraCoupons },
        null,
        2
      )
    );

    console.log("Cupons principais extraídos:", coupons.length);
    console.log("Cupons extras extraídos:", extraCoupons.length);
  } catch (erro) {
    console.error(erro);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

extrair();
