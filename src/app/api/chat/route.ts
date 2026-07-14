/**
 * ROTA DE COMPATIBILIDADE
 *
 * O endpoint oficial do Publ.IA Estratégico é /api/strategic/chat.
 * Esta rota permanece temporariamente para não quebrar clientes antigos.
 */
export {
  dynamic,
  runtime,
  POST,
} from "../strategic/chat/route";
