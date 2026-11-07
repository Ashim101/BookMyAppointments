/** Lets browsers and proxies reuse public responses; Express adds the ETag so revalidation costs a 304. */
export const cache = (seconds) => (_req, res, next) => {
  res.setHeader('Cache-Control', `public, max-age=${seconds}, must-revalidate`);
  next();
};
