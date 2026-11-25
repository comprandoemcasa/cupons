const puppeteer = require("puppeteer");
const fs = require("fs");

const URL_PRINCIPAIS =
  "https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/index.html";
const URL_EXTRAS =
  "https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/cupons-extras.html";
const URL_RESGATE =
  "https://mercadolivre.com.br/sec/31qRqvp";
const DATA_CUPONS_MANUAIS = "25/11/2026";
const USAR_FONTES_OFICIAIS = true;
const CUPONS_MANUAIS_HOJE = [
  {"code":"TODO2511SITE","discount":"R$220","min_purchase":"1299","max_discount":"220","category":"Site todo","open_sitewide":true,"start_date":"25/11/2026","end_date":"","product_list_url":URL_RESGATE,"coupon_type":"principal","has_code":true,"note":""},
  {"code":"SITETODO2511","discount":"R$50","min_purchase":"399","max_discount":"50","category":"Site todo","open_sitewide":true,"start_date":"25/11/2026","end_date":"","product_list_url":URL_RESGATE,"coupon_type":"principal","has_code":true,"note":""},
  {"code":"TODOSITE2511","discount":"R$30","min_purchase":"159","max_discount":"30","category":"Site todo","open_sitewide":true,"start_date":"25/11/2026","end_date":"","product_list_url":URL_RESGATE,"coupon_type":"principal","has_code":true,"note":""},
  {"code":"75MAIS1125MELI","discount":"R$75","min_purchase":"499","max_discount":"75","category":"Meli+","open_sitewide":false,"start_date":"25/11/2026","end_date":"","product_list_url":URL_RESGATE,"coupon_type":"principal","has_code":true,"note":"Exclusivo Meli+"},
  {"code":"ELETROTECHMELI","discount":"10%","min_purchase":"199","max_discount":"200","category":"Tecnologia e Eletrodomésticos","open_sitewide":false,"start_date":"25/11/2026","end_date":"","product_list_url":URL_RESGATE,"coupon_type":"principal","has_code":true,"note":""},
  {"code":"VIVERML","discount":"15%","min_purchase":"199","max_discount":"40","category":"Selecionados","open_sitewide":false,"start_date":"25/11/2026","end_date":"","product_list_url":URL_RESGATE,"coupon_type":"principal","has_code":true,"note":""},
  {"code":"OFFAUTO","discount":"18%","min_purchase":"199","max_discount":"80","category":"Automotivo","open_sitewide":false,"start_date":"25/11/2026","end_date":"","product_list_url":URL_RESGATE,"coupon_type":"principal","has_code":true,"note":""},
  {"code":"OBRASEGURA","discount":"18%","min_purchase":"199","max_discount":"80","category":"Construção","open_sitewide":false,"start_date":"25/11/2026","end_date":"","product_list_url":URL_RESGATE,"coupon_type":"principal","has_code":true,"note":""}
];

async function lerConstante(page, url, nome) {
  const arquivo = nome === "COUPONS" ? "index.html" : "cupons-extras.html";
  const urlFonte =
    "https://raw.githubusercontent.com/afiliadosmercadolivre/cupons-afiliadosmercadolivre/main/" + arquivo;
  const resposta = await fetch(urlFonte);

  if (!resposta.ok) {
    throw new Error("A fonte oficial respondeu com status " + resposta.status + ".");
  }

  const conteudo = await resposta.text();
  const expressao = new RegExp(
    "const\\s+" + nome + "\\s*=\\s*(\\[[\\s\\S]*?\\]);"
  );
  const resultado = conteudo.match(expressao);

  if (!resultado) {
    throw new Error("A lista " + nome + " não foi encontrada em " + urlFonte + ".");
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
    const dadosPrincipais = USAR_FONTES_OFICIAIS
      ? await lerConstante(page, URL_PRINCIPAIS, "COUPONS")
      : [];
    const dadosExtras = USAR_FONTES_OFICIAIS
      ? await lerConstante(page, URL_EXTRAS, "ITEMS")
      : [];

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
