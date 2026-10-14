import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

import * as strings from 'SistemaTdrWebPartStrings';
import SistemaTdr from './components/SistemaTdr';
import { ISistemaTdrProps } from './components/ISistemaTdrProps';

export interface ISistemaTdrWebPartProps {
  apiBaseUrl: string;
}

export default class SistemaTdrWebPart extends BaseClientSideWebPart<ISistemaTdrWebPartProps> {

  private static readonly defaultApiBaseUrl: string = 'https://sistematdr-g4c5asddesgbd7bh.southcentralus-01.azurewebsites.net';

  public render(): void {
    const element: React.ReactElement<ISistemaTdrProps> = React.createElement(
      SistemaTdr,
      {
        apiBaseUrl: this.properties.apiBaseUrl || SistemaTdrWebPart.defaultApiBaseUrl,
        aadHttpClientFactory: this.context.aadHttpClientFactory,
        spHttpClient: this.context.spHttpClient,
        webUrl: this.context.pageContext.web.absoluteUrl
      }
    );

    ReactDom.render(element, this.domElement);
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }

    const {
      semanticColors
    } = currentTheme;

    if (semanticColors) {
      this.domElement.style.setProperty('--bodyText', semanticColors.bodyText || null);
      this.domElement.style.setProperty('--link', semanticColors.link || null);
      this.domElement.style.setProperty('--linkHovered', semanticColors.linkHovered || null);
    }

  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField('apiBaseUrl', {
                  label: strings.ApiBaseUrlFieldLabel,
                  description: strings.ApiBaseUrlFieldDescription
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
