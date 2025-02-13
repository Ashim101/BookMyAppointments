import { paginate } from '../../utils/pagination.js';
import { AuditLog } from './audit.model.js';

const toDto = (log) => ({
  id: String(log._id),
  actor: { role: log.actor.role, id: log.actor.id, name: log.actor.name },
  action: log.action,
  target: log.target?.type ? { type: log.target.type, id: log.target.id } : null,
  meta: log.meta ?? {},
  ip: log.ip,
  createdAt: log.createdAt.toISOString(),
});

export function createAuditService({ logger }) {
  async function record({ actor, action, target = null, meta = {}, ip = '' }) {
    try {
      await AuditLog.create({ actor: { role: actor.role, id: actor.id, name: actor.name ?? '' }, action, target, meta, ip });
    } catch (err) {
      logger.error({ err, action }, 'failed to write audit log');
    }
  }

  async function list({ action, actorRole, from, to, page, limit }) {
    const filter = {};
    if (action) filter.action = action;
    if (actorRole) filter['actor.role'] = actorRole;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }
    return paginate(AuditLog, filter, { page, limit, sort: { createdAt: -1 }, map: toDto });
  }

  return { record, list };
}
