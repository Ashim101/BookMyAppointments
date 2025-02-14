import { z } from 'zod';

export const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};

export const buildPage = (items, total, page, limit) => ({
  items,
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

/** Runs a filtered, sorted, paginated query and maps documents to DTOs. */
export async function paginate(
  Model,
  filter,
  { page, limit, sort = { _id: -1 }, populate, map = (doc) => doc },
) {
  let query = Model.find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);
  if (populate) query = query.populate(populate);
  const [docs, total] = await Promise.all([query, Model.countDocuments(filter)]);
  return buildPage(await Promise.all(docs.map(map)), total, page, limit);
}

export const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
