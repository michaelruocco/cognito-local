import { Context } from "../services/context";
import { DataStoreFactory } from "../services/dataStore/factory";
import { FunctionConfig } from "../services/lambda";
import { UserPool } from "../services/userPoolService";
import { TokenConfig } from "../services/tokenGenerator";
import mergeWith from "lodash.mergewith";
import { KMSConfig } from "../services/crypto";
import type { ServerOptions } from "./server";
import os from "os";

export type UserPoolDefaults = Omit<
  UserPool,
  "Id" | "CreationDate" | "LastModifiedDate"
>;

export interface Config {
  LambdaClient: AWS.Lambda.ClientConfiguration;
  TriggerFunctions: FunctionConfig;
  UserPoolDefaults: UserPoolDefaults;
  KMSConfig?: AWS.KMS.ClientConfiguration & KMSConfig;
  ServerConfig: ServerOptions;
  TokenConfig: TokenConfig;
}

const getExternalNetworkInterfaceAddress = () => {
  const networkInterfaces = os.networkInterfaces();
  for (const key in networkInterfaces) {
    const networkInterface = networkInterfaces[key];
    const externalInterfaceAddress = networkInterface?.find(
      (i) => i.internal == false
    )?.address;
    if (externalInterfaceAddress) {
      return externalInterfaceAddress;
    }
  }
  return undefined;
};

const getHostname = () => {
  const hostname = process.env.ISSUER_HOST;
  if (hostname) {
    return hostname;
  }
  if (process.env.USE_EXTERNAL_IP_AS_HOSTNAME) {
    const externalIp = getExternalNetworkInterfaceAddress();
    if (externalIp) {
      return externalIp;
    }
  }
  return "localhost";
};

const hostname = getHostname();
const issuerHostname = process.env.ISSUER_HOST ?? "localhost";
const port = parseInt(process.env.PORT ?? "9229", 10);

export const DefaultConfig: Config = {
  LambdaClient: {
    credentials: {
      accessKeyId: "local",
      secretAccessKey: "local",
    },
    region: "local",
  },
  TriggerFunctions: {},
  UserPoolDefaults: {
    UsernameAttributes: ["email"],
  },
  TokenConfig: {
    IssuerDomain: `http://${issuerHostname}:${port}`,
  },
  KMSConfig: {
    credentials: {
      accessKeyId: "local",
      secretAccessKey: "local",
    },
    region: "local",
  },
  ServerConfig: {
    port,
    hostname,
    development: !!process.env.COGNITO_LOCAL_DEVMODE,
    https: false,
  },
};

export const loadConfig = async (
  ctx: Context,
  dataStoreFactory: DataStoreFactory
): Promise<Config> => {
  ctx.logger.debug("loadConfig");
  const dataStore = await dataStoreFactory.create(ctx, "config", {});

  const config = await dataStore.getRoot<Config>(ctx);

  return mergeWith(
    {},
    DefaultConfig,
    config ?? {},
    function customizer(objValue, srcValue) {
      if (Array.isArray(srcValue)) {
        return srcValue;
      }
    }
  );
};
