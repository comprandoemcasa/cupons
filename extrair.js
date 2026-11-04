const puppeteer = require("puppeteer");
const fs = require("fs");

const URL_PRINCIPAIS =
  "https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/index.html";
const URL_EXTRAS =
  "https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/cupons-extras.html";
const URL_RESGATE =
  "https://mercadolivre.com.br/sec/31qRqvp";
const DATA_CUPONS_MANUAIS = "04/11/2026";
const CUPONS_MANUAIS_HOJE = [
  { code: "ALLSITE04011", discount: "R$40", min_purchase: "399", max_discount: "40", category: "Todo o site", open_sitewide: true, start_date: "04/11/2026", end_date: "04/11/2026", product_list_url: URL_RESGATE, coupon_type: "principal", has_code: true, note: "" },
  { code: "DESCONTOS", discount: "10%", min_purchase: "79", max_discount: "100", category: "Todo o site", open_sitewide: true, start_date: "04/11/2026", end_date: "04/11/2026", product_list_url: URL_RESGATE, coupon_type: "principal", has_code: true, note: "" },
  { code: "SAUDEML", discount: "10%", min_purchase: "79", max_discount: "30", category: "Saúde", open_sitewide: false, start_date: "04/11/2026", end_date: "04/11/2026", product_list_url: URL_RESGATE, coupon_type: "principal", has_code: true, note: "" },
  { code: "MELIPROMO", discount: "10%", min_purchase: "149", max_discount: "200", category: "Tecnologia e Eletro", open_sitewide: false, start_date: "04/11/2026", end_date: "04/11/2026", product_list_url: URL_RESGATE, coupon_type: "principal", has_code: true, note: "" },
  { code: "DESCONTOSEMPRE", discount: "10%", min_purchase: "149", max_discount: "200", category: "Tecnologia e Eletro", open_sitewide: false, start_date: "04/11/2026", end_date: "04/11/2026", product_list_url: URL_RESGATE, coupon_type: "principal", has_code: true, note: "" },
  { code: "SEMPREMODA", discount: "12%", min_purchase: "79", max_discount: "60", category: "Moda", open_sitewide: false, start_date: "04/11/2026", end_date: "04/11/2026", product_list_url: URL_RESGATE, coupon_type: "principal", has_code: true, note: "" },
  { code: "AUTOSEMPRE", discount: "18%", min_purchase: "99", max_discount: "50", category: "Automotivo", open_sitewide: false, start_date: "04/11/2026", end_date: "04/11/2026", product_list_url: URL_RESGATE, coupon_type: "principal", has_code: true, note: "" },
  { code: "CONSTRUSEMPRE", discount: "20%", min_purchase: "79", max_discount: "70", category: "Construção", open_sitewide: false, start_date: "04/11/2026", end_date: "04/11/2026", product_list_url: URL_RESGATE, coupon_type: "principal", has_code: true, note: "" },
  { code: "CASASEMPRE", discount: "20%", min_purchase: "79", max_discount: "80", category: "Casa", open_sitewide: false, start_date: "04/11/2026", end_date: "04/11/2026", product_list_url: URL_RESGATE, coupon_type: "principal", has_code: true, note: "" },
  { code: "VEMCOMPRAR", discount: "22%", min_purchase: "1", max_discount: "500", category: "Seleção de vendedores", open_sitewide: false, start_date: "04/11/2026", end_date: "04/11/2026", product_list_url: URL_RESGATE, coupon_type: "principal", has_code: true, note: "" },
  { code: "PEGUEOFF", discount: "25%", min_purchase: "1", max_discount: "500", category: "Seleção de vendedores", open_sitewide: false, start_date: "04/11/2026", end_date: "04/11/2026", product_list_url: URL_RESGATE, coupon_type: "principal", has_code: true, note: "" },
  { code: "SUPERVANTAGEM", discount: "30%", min_purchase: "1", max_discount: "500", category: "Seleção de vendedores", open_sitewide: false, start_date: "04/11/2026", end_date: "04/11/2026", product_list_url: URL_RESGATE, coupon_type: "principal", has_code: true, note: "" }
];

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

    const officialCoupons = dadosPrincipais.map(item => ({
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

    const codigosOficiais = new Set(
      officialCoupons.map(item => String(item.code || "").trim().toUpperCase())
    );
    const hojeSP = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo"
    }).format(new Date());
    const manuaisAtivos =
      hojeSP === DATA_CUPONS_MANUAIS
        ? CUPONS_MANUAIS_HOJE.filter(
            item => !codigosOficiais.has(item.code.toUpperCase())
          )
        : [];
    const coupons = [...manuaisAtivos, ...officialCoupons];

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
