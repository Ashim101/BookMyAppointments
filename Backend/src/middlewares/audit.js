const SENSITIVE = /pass|token|secret|otp|signature/i;

const sanitize = (body) =>
  Object.fromEntries(
    Object.entries(body ?? {})
      .filter(([key]) => !SENSITIVE.test(key))
      .map(([key, value]) => [
        key,
        typeof value === 'string' && value.length > 200 ? `${value.slice(0, 200)}...` : value,
      ]),
  );

/**
 * Records an audit entry after a successful response. When `roles` is given,
 * only requests by those roles are recorded (for example doctor state changes
 * on an endpoint that patients also use).
 */
export const createAuditMiddleware =
  (auditService) =>
  (action, { targetType, roles } = {}) =>
  (req, res, next) => {
    const json = res.json.bind(res);
    res.json = (payload) => {
      const succeeded = res.statusCode < 400 && payload?.success;
      if (!succeeded || (roles && !roles.includes(req.user?.role))) return json(payload);
      const targetId = req.params.id ?? payload.data?.id;
      // The entry is written before replying so a client that reads the log next always sees it.
      auditService
        .record({
          actor: { role: req.user.role, id: req.user.id, name: req.user.name },
          action,
          target: targetType && targetId ? { type: targetType, id: String(targetId) } : null,
          meta: sanitize(req.valid?.body ?? req.body),
          ip: req.ip,
        })
        .finally(() => json(payload));
      return res;
    };
    next();
  };
