import { AadHttpClientFactory, SPHttpClient } from '@microsoft/sp-http';

export interface ISistemaTdrProps {
  apiBaseUrl: string;
  aadHttpClientFactory: AadHttpClientFactory;
  spHttpClient: SPHttpClient;
  webUrl: string;
}
