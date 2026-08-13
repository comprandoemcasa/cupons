const fs = require("fs");

async function extrair() {
  console.log("Atualizando lista de cupons...");

  // ADICIONE AQUI TODOS OS CUPOM QUE VOCÊ QUER MOSTRAR NA SUA PÁGINA:
  const todosOsCupons = [
    {
      code: "TECHEMCASA",
      discount: "10% OFF",
      min_purchase: "R$ 129",
      max_discount: "R$ 150"
    },
    {
      code: "COMPRINHASPRACASA",
      discount: "25% OFF",
      min_purchase: "R$ 19",
      max_discount: "R$ 150"
    },
    // Exemplo de como adicionar mais cupons facilmente:
    {
      code: "FRETEGRATIS",
      discount: "Frete Grátis",
      min_purchase: "R$ 79",
      max_discount: "R$ 30"
    }
  ];

  fs.writeFileSync("data.json", JSON.stringify(todosOsCupons, null, 2));
  console.log("data.json atualizado com sucesso!");
}

extrair();
