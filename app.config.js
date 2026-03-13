module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  },
});
