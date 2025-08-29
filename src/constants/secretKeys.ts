type SecretKeys = Parameters<typeof Bun.secrets.get>[0];

const service = "tinyfax";
const accessName = "accessToken";
const refreshName = "refreshToken";

const accessTokenKeys: SecretKeys = {
  service,
  name: accessName,
};

const refreshTokenKeys: SecretKeys = {
  service,
  name: refreshName,
};

export { accessTokenKeys, refreshTokenKeys };
