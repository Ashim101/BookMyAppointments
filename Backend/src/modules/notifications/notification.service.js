import { notFound } from '../../utils/AppError.js';
import { buildPage } from '../../utils/pagination.js';
import { Notification } from './notification.model.js';

const toDto = (n) => ({
  id: String(n._id),
  type: n.type,
  title: n.title,
  message: n.message,
  link: n.link,
  read: n.read,
  createdAt: n.createdAt.toISOString(),
});

export function createNotificationService({ logger }) {
  const scope = (user) => ({ userId: String(user.id), role: user.role });

  /** Best effort: a failed notification must never fail the action that caused it. */
  async function notify(recipient, { type, title, message, link = null }) {
    try {
      return await Notification.create({ ...scope(recipient), type, title, message, link });
    } catch (err) {
      logger.error({ err, type }, 'failed to create notification');
      return null;
    }
  }

  async function list(user, { unread, page, limit }) {
    const filter = scope(user);
    const [docs, total, unreadCount] = await Promise.all([
      Notification.find(unread ? { ...filter, read: false } : filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Notification.countDocuments(unread ? { ...filter, read: false } : filter),
      Notification.countDocuments({ ...filter, read: false }),
    ]);
    return { ...buildPage(docs.map(toDto), total, page, limit), unreadCount };
  }

  async function markRead(user, id) {
    const doc = await Notification.findOneAndUpdate(
      { _id: id, ...scope(user) },
      { $set: { read: true } },
      { returnDocument: 'after' },
    );
    if (!doc) throw notFound('Notification');
    return toDto(doc);
  }

  async function markAllRead(user) {
    const result = await Notification.updateMany({ ...scope(user), read: false }, { $set: { read: true } });
    return { updated: result.modifiedCount };
  }

  return { notify, list, markRead, markAllRead };
}
