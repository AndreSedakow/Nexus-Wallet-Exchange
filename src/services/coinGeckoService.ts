/**
 *Cotação — CoinGecko API 
 *
 * Responsabilidade única: buscar o preço atual de um par de tokens.
 * O rate retornado representa: "quanto 1 unidade de fromToken vale em toToken".
 * Decisão para mantemos o mapa de IDs separado do código de negócio
 * para facilitar a adição de novos tokens no futuro (ex: SOL, USDT e outros ativos).
 */
import Decimal from 'decimal.js';

// Mapa de símbolo interno → ID oficial da CoinGecko
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BRL: 'brl', // BRL é moeda fiduciária — tratado como caso especial abaixo
};

// URL base da API pública da CoinGecko para cotações simples
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

/**
 * Busca o preço de `fromToken` cotado em `toToken`.
 * Retorna o rate como string para manter precisão via Decimal.js no service de swap.
 * Exemplos:
 *   getSwapRate('BTC', 'BRL') → '350000.123...' (preço do BTC em BRL)
 *   getSwapRate('BRL', 'BTC') → '0.00000285...' (preço do BRL em BTC)
 *   getSwapRate('BTC', 'ETH') → '15.23...'      (preço do BTC em ETH)
 */
export async function getSwapRate(fromToken: string, toToken: string): Promise<string> {
  // Caso especial: tokens idênticos
  if (fromToken === toToken) {
    throw new Error('Os tokens de origem e destino não podem ser iguais.');
  }

  // Determina qual token é cripto e qual é BRL (se houver) para otimizar as chamadas à API
  const isBrlFrom = fromToken === 'BRL';
  const isBrlTo = toToken === 'BRL';

  // --- Caso 1: Cripto → BRL (ex: BTC → BRL) ---
  if (!isBrlFrom && isBrlTo) {
    const coinId = COINGECKO_IDS[fromToken];
    if (!coinId) throw new Error(`Token não suportado: ${fromToken}`);

    const rate = await fetchPriceInBrl(coinId);
    return rate.toString();
  }

  // --- Caso 2: BRL → Cripto (ex: BRL → BTC) ---
  if (isBrlFrom && !isBrlTo) {
    const coinId = COINGECKO_IDS[toToken];
    if (!coinId) throw new Error(`Token não suportado: ${toToken}`);

    const priceOfTarget = await fetchPriceInBrl(coinId);
    // Rate inverso: 1 BRL = (1 / preço do ativo em BRL)
    const rate = new Decimal(1).div(priceOfTarget);
    return rate.toString();
  }

  // --- Caso 3: Cripto → Cripto (ex: BTC → ETH) ---
  const fromId = COINGECKO_IDS[fromToken];
  const toId = COINGECKO_IDS[toToken];
  if (!fromId) throw new Error(`Token não suportado: ${fromToken}`);
  if (!toId) throw new Error(`Token não suportado: ${toToken}`);

  // Busca ambos em BRL e calcula as taxas cruzadas para obter o rate entre os dois ativos
  const [priceFrom, priceTo] = await Promise.all([
    fetchPriceInBrl(fromId),
    fetchPriceInBrl(toId),
  ]);

  // Rate: quanto 1 fromToken vale em toToken
  // ex: BTC = R$350.000, ETH = R$17.500 → 1 BTC = 20 ETH
  const rate = priceFrom.div(priceTo);
  return rate.toString();
}

/**
 * Função interna: busca o preço de um coin em BRL via CoinGecko.
 * Separada para reaproveitamento e facilitar mock em testes.
 */
async function fetchPriceInBrl(coinId: string): Promise<Decimal> {
  const url = `${COINGECKO_BASE_URL}/simple/price?ids=${coinId}&vs_currencies=brl`;

let response: Awaited<ReturnType<typeof fetch>>;
try {
  response = await fetch(url);
  } catch (err) {
    throw new Error(
      'Falha ao conectar com a API de cotações (CoinGecko). Verifique sua conexão.'
    );
  }

  if (!response.ok) {
    // Rate limit da CoinGecko pública: 429 Too Many Requests
    if (response.status === 429) {
      throw new Error(
        'Limite de requisições atingido na API de cotações. Tente novamente em instantes.'
      );
    }
    throw new Error(`Erro na API de cotações: HTTP ${response.status}`);
  }

 const data = await response.json() as Record<string, { brl: number }>;

// CoinGecko retorna {} se o ID for inválido
if (!data[coinId]?.brl) {
    throw new Error(
      `Cotação não encontrada para o token: ${coinId}. Verifique se o símbolo está correto.`
    );
  }

  return new Decimal(data[coinId].brl.toString());
}