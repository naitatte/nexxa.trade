import type { FastifyRequest, FastifyReply } from "fastify";

export const requestStartTimes = new WeakMap<FastifyRequest, number>();

export async function requestLogger(
  request: FastifyRequest,
  reply: FastifyReply
) {
  requestStartTimes.set(request, Date.now());
}
