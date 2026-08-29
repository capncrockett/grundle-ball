const shouldSkip =
  process.env.HUSKY === '0' ||
  process.env.CI === 'true' ||
  process.env.CI === '1' ||
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL === '1';

if (!shouldSkip) {
  try {
    const { default: husky } = await import('husky');
    const message = husky();
    if (message) console.log(message);
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    console.warn('Husky is not installed; skipping Git hook setup.');
  }
}
