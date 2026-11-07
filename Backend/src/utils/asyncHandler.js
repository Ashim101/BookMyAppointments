export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
