const puppeteer = require("puppeteer");
const fs = require("fs");

const URL_PRINCIPAIS =
  "https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/index.html";

const URL_EXTRAS =
  "https://afiliadosmercadolivre.github.io/cupons-afiliadosmercadolivre/cupons-extras.html";

// Cupons confirmados diretamente pelos gerentes do Mercado Livre que ainda
// não apareceram na página oficial. Quando o código entrar na fonte oficial,
// a versão oficial substitui automaticamente esta inclusão manual.
const CUPONS_MANUAIS = [
  {
    code: "QUEROPROMO",
    discount: "10%",
    min_purchase: "149",
    max_discount: "200",
    start_date: "01/09/2026",
    end_date: "",
    category: "Tecnologia e Eletrônicos",
    product_list_url:
      "https://lista.mercadolivre.com.br/_Container_tech-e-he",
    open_sitewide: false,
    coupon_type: "principal",
    has_code: true,
    note: ""
  },
  {
    code: "OFERTAJA",
    discount: "8%",
    min_purchase: "150",
    max_discount: "300",
    start_date: "01/09/2026",
    end_date: "",
    category: "Eletrodomésticos",
    product_list_url:
      "https://lista.mercadolivre.com.br/_Container_he-aff-2",
    open_sitewide: false,
    coupon_type: "principal",
    has_code: true,
    note: ""
  },
  {
    code: "OFERTASOFF",
    discount: "15%",
    min_purchase: "50",
    max_discount: "200",
    start_date: "01/09/2026",
    end_date: "",
    category: "Eletrodomésticos",
    product_list_url:
      "https://lista.mercadolivre.com.br/_Container_he-aff-1",
    open_sitewide: false,
    coupon_type: "principal",
    has_code: true,
    note: ""
  },
  {
    code: "SUPERDESCONTO",
    discount: "18%",
    min_purchase: "49",
    max_discount: "50",
    start_date: "01/09/2026",
    end_date: "",
    category: "Moda",
    product_list_url:
      "https://lista.mercadolivre.com.br/_Container_fashion-2026-2",
    open_sitewide: false,
    coupon_type: "principal",
    has_code: true,
    note: ""
  },
  {
    code: "MEGAOFF",
    discount: "15%",
    min_purchase: "79",
    max_discount: "60",
    start_date: "01/09/2026",
    end_date: "",
    category: "Casa e Decoração",
    product_list_url:
      "https://lista.mercadolivre.com.br/_Container_fh-afiliados-2026",
    open_sitewide: false,
    coupon_type: "principal",
    has_code: true,
    note: ""
  },
  {
    code: "GARANTEAQUI",
    discount: "20%",
    min_purchase: "19",
    max_discount: "100",
    start_date: "01/09/2026",
    end_date: "",
    category: "Construção e Ferramentas",
    product_list_url: "",
    open_sitewide: true,
    coupon_type: "principal",
    has_code: true,
    note: ""
  },
  {
    code: "MELICUPONS",
    discount: "20%",
    min_purchase: "79",
    max_discount: "60",
    start_date: "01/09/2026",
    end_date: "",
    category: "Auto Peças",
    product_list_url: "",
    open_sitewide: true,
    coupon_type: "principal",
    has_code: true,
    note: ""
  },
  {
    code: "DESCONTOSML",
    discount: "25%",
    min_purchase: "1",
    max_discount: "500",
    start_date: "01/09/2026",
    end_date: "",
    category: "Ofertas de vendedores",
    product_list_url:
      "https://lista.mercadolivre.com.br/_Container_aff-list-14",
    open_sitewide: false,
    coupon_type: "principal",
    has_code: true,
    note: ""
  },
  {
    code: "SEMPREML",
    discount: "25%",
    min_purchase: "1",
    max_discount: "500",
    start_date: "01/09/2026",
    end_date: "",
    category: "Ofertas de vendedores",
    product_list_url:
      "https://lista.mercadolivre.com.br/_Container_aff-list-15",
    open_sitewide: false,
    coupon_type: "principal",
    has_code: true,
    note: ""
  }
];

async function lerConstante(page, url, nomeDaConstante) {
  await page.goto(url, {
    waitUntil: "networkidle0",
    timeout: 120000
  });

  const conteudo = await page.$$eval(
    "script",
    (scripts, nome) => {
      const script = scripts.find(item =>
        item.textContent.includes(`const ${nome}`)
      );

      return script ? script.textContent : "";
    },
    nomeDaConstante
  );

  const expressao = new RegExp(
    `const\\s+${nomeDaConstante}\\s*=\\s*(\\[[\\s\\S]*?\\]);`
  );

  const resultado = conteudo.match(expressao);

  if (!resultado) {
    throw new Error(
      `A lista ${nomeDaConstante} não foi encontrada em ${url}.`
    );
  }

  return JSON.parse(resultado[1]);
}

function normalizarPercentual(valor, observacao) {
  const texto = String(valor || "").trim();

  if (!texto) {
    const achado = String(observacao || "").match(/(\d+(?:[,.]\d+)?)\s*%/);
    return achado ? `${achado[1].replace(".", ",")}%` : "";
  }

  if (texto.includes("%")) {
    return texto;
  }

  const numero = Number(texto.replace(".", "").replace(",", "."));

  if (numero > 0 && numero < 1) {
    return `${Math.round(numero * 100)}%`;
  }

  const achado = String(observacao || "").match(/(\d+(?:[,.]\d+)?)\s*%/);
  return achado ? `${achado[1].replace(".", ",")}%` : texto;
}

function normalizarDescontoExtra(item) {
  if (String(item.mecanica || "").toLowerCase() === "fixo") {
    const valor = String(item.desconto || item.desconto_max || "")
      .trim()
      .replace(/^R\$\s*/, "");

    return valor ? `R$${valor}` : "";
  }

  return normalizarPercentual(item.desconto, item.obs);
}

function normalizarDescontoPrincipal(item) {
  const texto = String(item.valor_desconto || "").trim();
  const numero = Number(
    texto.replace("%", "").replace(".", "").replace(",", ".")
  );

  // A fonte às vezes transforma R$ 200 em 20.000% por causa da
  // formatação da planilha. Nesse caso usamos o limite informado.
  if (texto.includes("%") && numero > 100) {
    return item.desconto_max ? `R$${item.desconto_max}` : texto;
  }

  return texto;
}

async function extrair() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"]
  });

  try {
    const page = await browser.newPage();

    const dadosPrincipais = await lerConstante(
      page,
      URL_PRINCIPAIS,
      "COUPONS"
    );

    const dadosExtras = await lerConstante(
      page,
      URL_EXTRAS,
      "ITEMS"
    );

    const cuponsOficiais = dadosPrincipais.map(item => ({
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
      cuponsOficiais.map(item => String(item.code).toUpperCase())
    );

    const cupons = [
      ...CUPONS_MANUAIS.filter(
        item => !codigosOficiais.has(String(item.code).toUpperCase())
      ),
      ...cuponsOficiais
    ];

    const extraCoupons = dadosExtras.map(item => {
      const possuiCodigo =
        String(item.tipo_cupom || "").toLowerCase() !== "cuponeria" &&
        Boolean(String(item.nome_cupom || "").trim());

      return {
        code: possuiCodigo
          ? String(item.nome_cupom).trim()
          : "DESCONTO AUTOMÁTICO",
        discount: normalizarDescontoExtra(item),
        min_purchase: item.asp_minimo || "",
        max_discount: item.desconto_max || "",
        start_date: item.data_inicial || "",
        end_date: item.data_final || "",
        category: item.categoria || item.vertical || "Cupom extra",
        product_list_url: item.url || "",
        open_sitewide: false,
        coupon_type: "extra",
        has_code: possuiCodigo,
        note: item.obs || ""
      };
    });

    if (cupons.length === 0) {
      throw new Error("O Mercado Livre retornou uma lista principal vazia.");
    }

    const atualizadoEm = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date()).replace(",", "");

    const dadosDaPagina = {
      updated_at: atualizadoEm,
      coupons: cupons,
      extra_coupons: extraCoupons
    };

    fs.writeFileSync(
      "data.json",
      JSON.stringify(dadosDaPagina, null, 2)
    );

    console.log("Cupons principais extraídos:", cupons.length);
    console.log("Cupons extras extraídos:", extraCoupons.length);
  } catch (erro) {
    console.error(erro);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

extrair();
