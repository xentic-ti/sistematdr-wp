# Análisis técnico del Sistema TDR recuperado

Fecha del análisis: 2026-09-25  
Proyecto analizado: `C:\sharepoint\SistemaTDR`  
Referencia recuperada encontrada en: `C:\sharepoint\sistemtdrsppkg\SPPKG-Extraido`

> Nota de alcance: el requerimiento indicaba una carpeta `referencia-sppkg` dentro del proyecto, pero esa carpeta no existe en `C:\sharepoint\SistemaTDR`. El único contenido que coincide con la descripción se encontró en la carpeta hermana indicada arriba y se usó como referencia. No se llamó a SharePoint, Azure ni a ningún endpoint; el análisis fue completamente estático. Las referencias a líneas del bundle corresponden a una copia temporal desminificada solo para inspección, no conservada en el proyecto.

## 1. Resumen ejecutivo

El paquete recuperado contiene un WebPart SPFx funcional, compilado con SPFx 1.17.4 y React 17.0.1. Su interfaz permite:

1. Seleccionar o arrastrar un PDF de TDR.
2. Enviarlo autenticado a una API ASP.NET alojada en Azure App Service.
3. Mostrar once grupos de información extraída.
4. Consultar los TDR ya guardados en una lista SharePoint llamada `TDR_analisis`.
5. Abrir el detalle de un registro, abrir el PDF o carpeta vinculada y cambiar su estado.
6. Conversar sobre un TDR mediante un chat persistente servido por el mismo backend.

La arquitectura anterior era híbrida:

- **SPFx** proporcionaba la interfaz y validación básica del PDF.
- **SharePoint REST** leía directamente la lista `TDR_analisis` y actualizaba la columna de estado usando los permisos del usuario actual.
- **ASP.NET/Azure App Service** recibía el PDF, realizaba el análisis, guardaba el resultado en SharePoint y devolvía el ID creado. También gestionaba sesiones, historial y mensajes del chat.
- **Microsoft Entra ID** protegía la API con el recurso `api://b02153e0-a22d-4fef-8ed1-7fa0d3769a57` y el scope delegado `access_as_user`.
- **Azure/OpenAI** es una dependencia muy probable del backend del chat porque el contrato expone `azureResponseId` y la UI habla de respuestas de IA, pero el proveedor, modelo, deployment, prompts, índice y credenciales no están presentes en el SPPKG.

No se detectaron llamadas a Microsoft Graph. Tampoco se detectó almacenamiento funcional del WebPart en `localStorage` o `sessionStorage`; las únicas referencias pertenecen a código interno de Fluent UI para idioma/dirección de escritura.

La base nueva SPFx 1.18.2 + React 17 es adecuada para reconstruir la solución sin bajar versiones. Sin embargo, todavía carece de `@microsoft/sp-http` como dependencia directa, del permiso Web API, de la propiedad `apiBaseUrl` y de toda la implementación funcional. No se recomienda copiar literalmente los GUID del paquete antiguo sin decidir antes si la reconstrucción debe reemplazar la solución instalada o coexistir con ella.

**Evidencia principal:** `AppManifest.xml`; `ff78c760-0367-47d9-acc6-0a50d651dcc0/WebPart_c230d6b4-4627-4e6d-b15f-373b2674ef3f.xml`; `ClientSideAssets/sistema-tdr-web-part_4e54233b5d56835d494a.js`; `ClientSideAssets/SistemaTdrWebPartStrings_en-us_66122f4c37ca5b2007aa8f5643141a70.js`.

## 2. Arquitectura detectada

### 2.1 Diagrama lógico

```text
Usuario en SharePoint/Teams
        |
        v
WebPart SPFx 1.17.4 + React 17 + Fluent UI
        |
        +-- SPHttpClient ------------------------------+
        |                                              |
        |   GET campos/items/detalle                   v
        |   PATCH Estado                         SharePoint Online
        |                                        Lista TDR_analisis
        |
        +-- AadHttpClient (token Entra ID) ------------+
                                                       |
            api://b02153e0-... / access_as_user        v
                                              Azure App Service / ASP.NET
                                              - analizar PDF
                                              - guardar TDR y devolver ID
                                              - sesiones e historial de chat
                                              - procesar preguntas con IA
                                              - devolver fuentes
```

### 2.2 Capas recuperadas

| Capa | Responsabilidad demostrada | Evidencia |
|---|---|---|
| Presentación SPFx/React | Carga de PDF, resultados, historial, detalle, estado y panel de chat | Bundle `sistema-tdr-web-part_4e54233b5d56835d494a.js` |
| Cliente de análisis | `multipart/form-data`, adquisición de token y normalización de respuesta | Bundle, servicio que llama `/api/tdr/analizar` |
| Cliente SharePoint | Descubrimiento dinámico de campos, lectura paginada y `PATCH` de estado | Bundle, servicio sobre `SPHttpClient` |
| Cliente de chat | Bootstrap, sesión, historial, nueva conversación y envío de mensaje | Bundle, servicio sobre `AadHttpClient` |
| Backend ASP.NET | Análisis, guardado inicial y orquestación del chat | Contratos, rutas y mensajes de error del bundle; no se recuperó su código |
| SharePoint | Persistencia visible de análisis y acceso al PDF/carpeta | Lista `TDR_analisis` y llamadas REST del bundle |
| Azure/IA | Hosting de API y respuesta de IA | URL de App Service, `azureResponseId` y textos de la UI |

### 2.3 Versiones y empaquetado anteriores

- Solución: `sistematdr-client-side-solution`.
- Versión del paquete: `1.0.0.9`.
- Versión del componente: `0.0.1`.
- SPFx: `1.17.4`.
- React/React DOM: `17.0.1`.
- Hosts soportados: SharePoint WebPart, Teams Personal App, Teams Tab y SharePoint Full Page.
- Activos incluidos en el SPPKG (`includeClientSideAssets` implícito por el paquete).
- Despliegue en todo el tenant habilitable: `SkipFeatureDeployment="true"`.
- Solución no aislada por dominio: `IsDomainIsolated="false"`.

**Evidencia:** `AppManifest.xml` y el atributo `ComponentManifest` de `WebPart_c230d6b4-4627-4e6d-b15f-373b2674ef3f.xml`.

## 3. Flujo funcional del Sistema TDR

### 3.1 Nuevo análisis

1. El usuario abre la pestaña **Nuevo análisis**.
2. Selecciona o arrastra un archivo.
3. El navegador valida que el nombre termine en `.pdf`, que el MIME sea `application/pdf` si está informado y que el tamaño sea mayor que cero. No se encontró límite de tamaño del lado cliente.
4. Al pulsar **Analizar TDR**, el WebPart obtiene un `AadHttpClient` para el recurso de la API.
5. Construye `FormData` y agrega el archivo bajo el nombre `archivo`.
6. Envía un `POST` a `{apiBaseUrl}/api/tdr/analizar`.
7. Normaliza distintas variantes de mayúsculas y nombres del JSON devuelto.
8. Exige que la respuesta contenga un identificador de elemento SharePoint (`tdrItemId`, `itemId` o `sharePointItemId`, con variantes de mayúsculas). Si falta, considera incompleto el backend.
9. Muestra los campos extraídos y afirma que el registro fue guardado automáticamente en `TDR_analisis`.
10. Incrementa una clave de refresco local para que la pestaña de procesados vuelva a consultar SharePoint.

**Conclusión:** la extracción y el guardado inicial no se realizan en SPFx; el backend debe hacer ambas cosas y devolver el ID resultante.  
**Evidencia:** bundle, método de análisis y textos “Guardado automáticamente en TDR_analisis” / “el backend no confirmó el guardado”.

### 3.2 Consulta de TDR procesados

1. El WebPart consulta primero los campos visibles de la lista.
2. Detecta columnas por `InternalName` o título normalizados, en lugar de exigir todos los nombres exactos.
3. Solicita los primeros 50 elementos, ordenados por `Created desc` si existe esa columna o por `ID desc` en caso contrario.
4. Sigue `@odata.nextLink`/`d.__next` mediante el botón **Cargar más**.
5. Filtra en memoria por número, entidad, objeto de contratación, estado o plazo.
6. Renderiza lista de escritorio y tarjetas adaptables para móvil.

**Evidencia:** bundle, servicio SharePoint `getFields`, `buildItemsUrl`, `getNextPage` y componente de historial.

### 3.3 Detalle y estado

1. **Ver registro** solicita el elemento por ID y selecciona solo las columnas detectadas.
2. Presenta información general y secciones en acordeón.
3. Permite cambiar el estado únicamente a uno de cinco valores codificados.
4. Actualiza SharePoint directamente mediante `PATCH` con `IF-MATCH: *`.

No existe control de concurrencia optimista real: `IF-MATCH: *` permite sobrescribir el valor actual. La autorización depende de los permisos SharePoint del usuario.

**Evidencia:** bundle, métodos `getTdrById`, `updateStatus` y `patchJson`.

### 3.4 Chat

1. El usuario abre el panel desde el resultado reciente, el listado o el detalle.
2. El WebPart intenta `GET /api/tdr-chat/bootstrap?tdrItemId=...`.
3. Solo si bootstrap responde 404 usa el flujo antiguo de compatibilidad: abre sesión y luego obtiene historial.
4. La sesión y mensajes se conservan en el backend; el navegador solo mantiene el estado React mientras el componente está vivo.
5. Una nueva conversación reutiliza opcionalmente el `sessionId` actual en la petición.
6. Cada mensaje incorpora un `clientMessageId` UUID generado en el cliente para correlación/idempotencia potencial.
7. El backend devuelve por separado el mensaje del usuario y el del asistente, además de fuentes opcionales.

**Evidencia:** bundle, servicio de chat y componente del panel.

## 4. Interfaz recuperada

### 4.1 Estructura visual

- Cabecera azul con “Sistema TDR”, “Análisis de documentos TDR” y texto introductorio.
- Navegación tipo Pivot con **Nuevo análisis** y **TDR procesados**.
- Zona de carga por clic o drag-and-drop, con resumen de nombre y tamaño.
- Botones **Analizar TDR**, **Limpiar** y, tras analizar, **Ver TDR procesados**.
- Indicadores de carga, barras de éxito/error y diseño responsivo.
- Panel lateral mediano para el chat.

### 4.2 Tarjetas del resultado inmediato

La respuesta del análisis mostraba:

- Entidad.
- Área usuaria.
- Requisitos mínimos.
- Anexos obligatorios.
- Solución.
- Consultas TI.
- Experiencia del proveedor.
- Personal clave.
- Forma de pago.
- Penalidades.
- Plazo.

El valor ausente se normaliza como `No especificado`. Números usan locale `es-PE`, booleanos se muestran como Sí/No y arrays se unen por saltos de línea.

### 4.3 Historial y detalle

- Búsqueda cliente: número, entidad, objeto de contratación, estado y plazo.
- Columnas de escritorio condicionales: Número, Entidad, Estado, Plazo, Modificado y Acciones.
- Acciones: conversar, ver registro y abrir PDF cuando existe URL.
- Detalle: número, fechas, plazo, autor, estado, link y secciones analizadas.
- Estados permitidos: `Nuevo`, `Aprobado`, `En Evaluación`, `No aplicable`, `Enviado a Entidad`.
- El enlace se abre en otra pestaña. El código acepta URL absoluta HTTP(S) o una ruta relativa al host de SharePoint.

### 4.4 Adaptabilidad y tema

Hay puntos de quiebre a 992 px y 720 px. En móvil la tabla se reemplaza por tarjetas, el encabezado y formulario de estado se apilan, y la grilla de resultados pasa a una columna. Se emplean tokens de tema de SharePoint y componentes Fluent UI v8.

**Evidencia de toda esta sección:** CSS y JSX compilados dentro del bundle.

## 5. Listas y columnas SharePoint detectadas

### 5.1 Lista

| Elemento | Valor | Certeza | Evidencia |
|---|---|---:|---|
| Nombre de lista | `TDR_analisis` | Confirmado | Constante del servicio SharePoint y mensajes de UI del bundle |
| List ID | No recuperado | No disponible | No aparece GUID de lista en los activos |
| Sitio | Sitio actual del WebPart (`pageContext.web.absoluteUrl`) | Confirmado | Render del WebPart en el bundle |
| Biblioteca de documentos | No identificada | No disponible | Solo se conserva una URL en un campo detectado |

### 5.2 Campos del sistema y campos candidatos

El cliente consulta metadatos y resuelve el nombre interno real. Los siguientes son **nombres candidatos normalizados**, no garantía de que el nombre interno exacto tenga esa grafía.

| Uso lógico | Candidatos detectados | Uso |
|---|---|---|
| ID | `ID` exacto | Lectura, detalle y relación con chat |
| Creado | `Created` exacto | Orden y fecha |
| Modificado | `Modified` exacto | Fecha |
| Autor | `Author` exacto | `Title` y `EMail` mediante `$expand` |
| Número TDR | `nrotdr`, `numerotdr` | Lista, búsqueda, detalle |
| Entidad | `entidad`, `title` | Lista, búsqueda, detalle |
| Área usuaria | `areausuaria`, `area` | Lista/detalle |
| Objeto contratación | `objetocontratacion`, `objetodecontratacion`, `objeto` | Búsqueda y resumen de lista |
| Estado | `estado`, `status` | Lista, detalle y escritura |
| Plazo | `plazo` | Lista, búsqueda y detalle |
| PDF/enlace | `pdf`, `urlpdf`, `enlacepdf`, `archivopdf`, `documentopdf`, `linktdr`, `archivo`, `documento` | Apertura de PDF/carpeta |
| Resumen | `resumen`, `summary` | Resumen del historial |
| Requisitos mínimos | `requisitosminimos` | Detalle |
| Anexos obligatorios | `anexosobligatorios` | Detalle |
| Solución | `solucion` | Detalle |
| Experiencia proveedor | `experienciapostor`, `experienciaproveedor` | Detalle |
| Personal clave | `personalclave` | Detalle |
| Forma de pago | `formapago` | Detalle |
| Penalidades | `penalidades` | Detalle |
| Consultas TI | `consultasti` | Detalle |

La normalización elimina acentos, guiones, espacios y secuencias `_xNNNN_`. Para el campo PDF solo acepta tipos SharePoint `URL`, `Text` o `Note`.

### 5.3 REST SharePoint recuperado

```text
GET {webUrl}/_api/web/lists/getbytitle('TDR_analisis')/fields
    ?$select=Title,InternalName,TypeAsString,Hidden,ReadOnlyField
    &$filter=Hidden eq false

GET {webUrl}/_api/web/lists/getbytitle('TDR_analisis')/items
    ?$select=...
    &$expand=Author
    &$orderby=Created desc (o ID desc)
    &$top=50

GET {webUrl}/_api/web/lists/getbytitle('TDR_analisis')/items({id})
    ?$select=...
    &$expand=Author

PATCH {webUrl}/_api/web/lists/getbytitle('TDR_analisis')/items({id})
```

Headers de lectura: `Accept: application/json;odata=nometadata`.  
Headers de escritura: el anterior más `Content-Type: application/json;odata=nometadata` e `IF-MATCH: *`.

**Evidencia:** bundle, servicio SharePoint.

## 6. APIs y endpoints detectados

### 6.1 Backend ASP.NET

Base configurable y valor predeterminado recuperado:

`https://sistematdr-g4c5asddesgbd7bh.southcentralus-01.azurewebsites.net`

| Método | Ruta | Solicitud | Respuesta/uso inferible |
|---|---|---|---|
| POST | `/api/tdr/analizar` | `multipart/form-data`, parte `archivo` | Resultado analizado y un ID de `TDR_analisis` |
| GET | `/api/tdr-chat/bootstrap?tdrItemId={id}` | Sin body | `{success,data:{session,messages}}`; ruta preferida |
| POST | `/api/tdr-chat/sessions` | `{tdrItemId}` | Sesión activa; fallback si bootstrap da 404 |
| GET | `/api/tdr-chat/history?tdrItemId={id}&sessionId={id}` | Sin body | Array/historial de mensajes |
| POST | `/api/tdr-chat/new-conversation` | `{tdrItemId,sessionId?}` | Nueva sesión/conversación |
| POST | `/api/tdr-chat/messages` | `{tdrItemId,sessionId,message,clientMessageId}` | Mensaje usuario, mensaje asistente y estado |

Todas las llamadas utilizan `AadHttpClient`. Los POST de chat declaran `Content-Type: application/json`; el endpoint de análisis deja que el navegador establezca el boundary de `multipart/form-data`.

### 6.2 Contratos recuperados

Resultado de análisis normalizado:

```text
tdrItemId, numeroTdr, entidad, areaUsuaria, requisitosMinimos,
anexosObligatorios, solucion, consultasTi, experienciaProveedor,
personalClave, formaPago, penalidades, plazo
```

Sesión de chat:

```text
sessionId, tdrItemId, numeroTdr, title, status,
createdAt, lastMessageAt, azureResponseId
```

Mensaje de chat:

```text
messageId, sessionId, role(user|assistant|system), content,
createdAt, order, azureResponseId, sources[]
```

Fuente:

```text
id, title, fileName, url, snippet, score
```

El WebPart tolera envoltorios y capitalización diferentes (`data`, `result`, `value`, `Data`, etc.), lo que sugiere evolución o coexistencia de versiones del backend.

### 6.3 Microsoft Graph

No se hallaron rutas `graph.microsoft.com`, `MSGraphClient` ni `GraphClient`. La solución anterior no usa Microsoft Graph de forma demostrable.

## 7. Integración con ASP.NET

### 7.1 Funciones obligatoriamente dependientes del backend anterior

- Recepción del PDF y extracción de contenido.
- Conversión del contenido a los campos estructurados del resultado.
- Guardado inicial del análisis en `TDR_analisis` y devolución de su ID.
- Creación/recuperación de sesiones de chat.
- Persistencia y recuperación del historial.
- Orquestación de preguntas y respuestas de IA.
- Generación o recuperación de fuentes asociadas a una respuesta.

Estas dependencias están demostradas por las rutas consumidas y los mensajes de error, aunque no se recuperó la implementación ASP.NET.

### 7.2 Funciones que no dependían del backend

- Render y navegación de la interfaz.
- Validación superficial del archivo.
- Consulta de lista y campos.
- Búsqueda local y paginación.
- Consulta del detalle.
- Cambio de estado.
- Apertura del enlace PDF/carpeta.

### 7.3 Señales específicas de ASP.NET

El mensaje para HTTP 415 dice que el endpoint debe aceptar JSON mediante un modelo `[FromBody]`, señal inequívoca de ASP.NET Core/MVC. La API devuelve o espera JSON flexible y utiliza `X-Correlation-ID` en respuestas de chat.

**Evidencia:** bundle, gestión de errores del servicio de chat.

## 8. Integración con Azure/OpenAI

### 8.1 Confirmado

- El backend predeterminado está alojado en Azure App Service (`azurewebsites.net`).
- El contrato de sesión y mensaje incluye `azureResponseId`.
- El cliente denomina la respuesta “respuesta de la IA”.
- Las respuestas pueden incluir fuentes con URL, fragmento y score.

### 8.2 Inferencia razonable, no demostrada

El chat probablemente utilizaba Azure OpenAI y posiblemente una capa de recuperación/búsqueda documental. `azureResponseId` y las fuentes puntuadas son compatibles con esa arquitectura, pero no prueban un producto concreto.

### 8.3 No recuperado

- Recurso, endpoint o deployment de Azure OpenAI.
- Modelo y versión.
- Azure AI Search, índice, embeddings o estrategia RAG.
- Prompt de sistema o instrucciones.
- Temperatura, límites de tokens o filtros de contenido.
- Storage Account, Blob Storage, SQL, Cosmos DB u otro almacén.
- Credenciales, managed identity o configuración de Key Vault.

No se encontraron secretos, tokens, API keys, connection strings ni contraseñas en los archivos del SPPKG.

## 9. Funcionamiento del chat

El chat está asociado a un elemento de `TDR_analisis` mediante `tdrItemId`. El panel muestra la entidad/título y el estado de la sesión. Recupera la conversación al abrirse y aborta la carga si el panel cambia de TDR o se cierra.

Características comprobadas:

- Bootstrap optimizado con fallback de compatibilidad.
- Historial ordenado por `order` y, como desempate, `createdAt`.
- Roles visuales `user`, `assistant` y `system`.
- Máximo cliente de 4.000 caracteres por pregunta.
- Botón **Nueva conversación**.
- Generación de `clientMessageId` con formato UUID v4 aproximado.
- Deduplicación de mensajes por `messageId`.
- Fuentes clicables solo cuando la URL es HTTP(S).
- Presentación de `fileName` o `title`; `snippet` y `score` se reciben pero no se muestran en la UI recuperada.
- Manejo específico de HTTP 400, 401/403, 404, 408, 409, 415, 429 y 500.
- Registro de duración, fallback, cantidad de mensajes, status y correlation ID mediante `Log.info` de SPFx.

No hay streaming, WebSocket ni Server-Sent Events; el cliente espera la respuesta completa de cada POST.

**Evidencia:** bundle, servicio y componentes del chat.

## 10. Autenticación y permisos

### 10.1 API propia

| Dato | Valor | Evidencia |
|---|---|---|
| Nombre del recurso solicitado en el paquete | `SistemaTDR API` | `AppManifest.xml` |
| Scope | `access_as_user` | `AppManifest.xml` |
| URI/audience usada por AadHttpClient | `api://b02153e0-a22d-4fef-8ed1-7fa0d3769a57` | Bundle |
| Flujo | Delegado, en nombre del usuario actual | Uso de `aadHttpClientFactory.getClient(...)` |

El permiso debe aprobarse en el Centro de administración de SharePoint. El bundle tiene mensajes explícitos para permisos no aprobados y respuestas 401/403.

El GUID anterior corresponde a la URI de aplicación/recurso usada por el cliente. No se recuperó explícitamente el Tenant ID. Tampoco puede demostrarse solo con el paquete si ese GUID coincide con el Application (client) ID o si se definió como URI personalizada, aunque el formato sugiere el GUID de una app registration.

### 10.2 SharePoint

`SPHttpClient` actúa con la identidad del usuario actual. Para usar todas las funciones, el usuario necesita:

- permiso de lectura sobre la lista `TDR_analisis`;
- permiso de edición para actualizar `Estado`;
- acceso al destino guardado en el campo PDF/enlace.

El código no solicita permisos Graph ni app-only. No contiene lógica propia de roles, grupos o autorización; confía en SharePoint y en el backend.

### 10.3 Usuarios y sesiones

- El historial de lista muestra `Author/Title` o, como alternativa, `Author/EMail`.
- El WebPart no envía manualmente nombre, correo ni token en el body; `AadHttpClient` agrega el token.
- No se conserva el `sessionId` en almacenamiento web. La recuperación depende del backend, que debe asociar el usuario/token, el TDR y una sesión activa.
- No se pudo determinar el esquema de autorización interno del backend ni si filtra registros por usuario.

## 11. Dependencias externas

| Dependencia | Uso | Tipo |
|---|---|---|
| SharePoint Framework 1.17.4 | Runtime y empaquetado antiguo | Plataforma |
| React / React DOM 17.0.1 | UI | Biblioteca |
| Fluent UI v8 / Office UI Fabric | Pivot, botones, lista, panel, dropdown, campos, iconos y estilos | Biblioteca incluida en bundle |
| `@microsoft/sp-http` 1.17.4 | `SPHttpClient` y `AadHttpClient` | SPFx |
| SharePoint REST | Lista, campos, elementos y actualización | Servicio Microsoft 365 |
| Microsoft Entra ID | Token delegado para API | Identidad |
| Azure App Service | Hosting del backend | Azure |
| Servicio de IA no identificado | Análisis/chat | Externo, inferido parcialmente |
| CDN de iconos Fluent UI | `https://static2.sharepointonline.com/files/fabric/assets` | Recurso estático de Microsoft |

No se encontró Axios, Microsoft Graph, PnPjs, SignalR, WebSocket ni otra SDK de datos en la lógica propia.

## 12. Funcionalidades reconstruibles

### Clasificación global

| Funcionalidad | Clase | Justificación |
|---|---|---|
| Interfaz, navegación, responsive y tema | **A. SPFx** | Implementación completa visible en bundle |
| Selección, drag-and-drop y validación básica PDF | **A. SPFx** | Función puramente cliente |
| Render de resultado JSON | **A. SPFx** | Contrato recuperado |
| Búsqueda local y paginación | **A. SPFx** | Lógica recuperada |
| Consulta de `TDR_analisis` | **B. SharePoint** | Requiere SharePoint REST y permisos de lectura |
| Detalle y campo Author | **B. SharePoint** | Requiere REST y `$expand` |
| Cambio de Estado | **B. SharePoint** | Requiere REST y permiso de edición |
| Apertura del PDF/carpeta | **B. SharePoint** o enlace externo | El WebPart solo abre la URL almacenada |
| Análisis semántico del PDF | **C/D. Backend + servicio externo** | La UI solo envía el archivo a ASP.NET |
| Guardado inicial y devolución de ID | **C. Backend ASP.NET** en la versión anterior | La UI lo exige al endpoint |
| Sesiones e historial de chat | **C. Backend ASP.NET** | Rutas dedicadas y persistencia remota |
| Respuesta de IA y fuentes | **C/D. Backend + Azure/IA** | Contrato del chat |
| Modelo, prompts, índice, esquema de almacenamiento | **E. Insuficiente información** | No están en el SPPKG |
| Filtrado de datos por usuario | **E. Insuficiente información** | No existe lógica cliente demostrable |

### Qué puede reconstruirse directamente

La UI completa, el cliente SharePoint y los contratos de cliente de la API son reconstruibles con alta fidelidad. La detección dinámica de columnas también puede reproducirse, aunque para una solución nueva conviene definir y documentar un esquema canónico antes de mantener tanta tolerancia a variantes.

## 13. Funcionalidades que requieren backend

### Deben permanecer en un backend por seguridad o capacidad

- Llamadas a Azure OpenAI u otro proveedor usando secretos, API keys o managed identity.
- Procesamiento intensivo del PDF, OCR y extracción semántica si requieren servicios protegidos.
- Prompting y reglas empresariales que no deban exponerse al navegador.
- Acceso app-only a SharePoint, si se necesita operar más allá de los permisos del usuario.
- Persistencia robusta del chat, control de concurrencia, idempotencia, cuotas, auditoría y rate limiting.
- Validación real del PDF (contenido, malware, tamaño, páginas y formato), no solo extensión/MIME.
- Correlación y observabilidad centralizadas.

### Podrían pasar a SPFx/SharePoint REST

- Creación del elemento `TDR_analisis` después de recibir datos ya estructurados, siempre que deba respetar los permisos del usuario.
- Lectura, detalle, paginación y cambio de estado; ya estaban en SPFx.
- Carga del PDF a una biblioteca SharePoint con `SPHttpClient`, si la seguridad y tamaño lo permiten.
- Metadatos de sesión simples podrían almacenarse en listas SharePoint, aunque no elimina la necesidad del backend para IA.

### Podrían resolverse con Microsoft Graph

Graph podría usarse para archivos en drives/bibliotecas y, si la arquitectura futura lo justifica, para datos de usuario. No aporta una sustitución directa del análisis de PDF ni del chat con IA. Como la versión recuperada no usa Graph, introducirlo sería una decisión nueva, no una restauración.

### Evaluación sobre eliminar ASP.NET

Es viable eliminar **el proyecto ASP.NET antiguo** solo si se sustituye por otro componente seguro equivalente: Azure Functions, Container Apps, App Service modernizado u otro backend. No es recomendable mover secretos ni llamadas privilegiadas de IA directamente al WebPart. Una arquitectura “solo SPFx” sería razonable únicamente para lectura/escritura SharePoint y UI, no para reproducir de forma segura el análisis y chat demostrados.

## 14. Información que no pudo recuperarse

- Código fuente, framework/versión exacta y configuración del backend ASP.NET.
- Tenant ID, nombre del tenant y URL del sitio SharePoint.
- GUID de la lista `TDR_analisis`.
- Nombres internos exactos de las columnas existentes; solo se recuperaron candidatos y campos del sistema.
- Tipos, obligatoriedad, longitud y configuración de cada columna, salvo la restricción de tipo del enlace PDF.
- Biblioteca, carpeta y convención usada para almacenar PDFs.
- Cómo el backend se autentica contra SharePoint y con qué permisos.
- Si el backend guarda el PDF antes o después del análisis.
- Esquema de almacenamiento de sesiones y mensajes.
- Relación exacta entre usuario y sesiones.
- Implementación de análisis, OCR, IA, prompts y reglas de negocio.
- Proveedor/modelo IA, deployment y configuración.
- Cómo se calculan `sources`, `snippet` y `score`.
- Límites backend de tamaño, timeout y formatos PDF.
- Política CORS exacta.
- Telemetría, Application Insights y retención de logs.
- Estado actual del App Service y de la app registration; no se hicieron llamadas de red.
- Pruebas, accesibilidad validada y comportamiento real con datos de producción.

## 15. Riesgos de la reconstrucción

| Riesgo | Impacto | Observación |
|---|---|---|
| Contrato backend incompleto | Alto | El cliente tolera múltiples formas de JSON, señal de versiones cambiantes |
| Esquema SharePoint no fijado | Alto | La detección flexible puede enlazar una columna equivocada, especialmente `Title` como entidad |
| Identidad/API antigua no disponible | Alto | Sin app registration, scope aprobado y backend, análisis y chat no funcionan |
| GUID de solución/componente distintos | Alto | La nueva solución no reemplazará automáticamente la instalada |
| Escritura con `IF-MATCH: *` | Medio | Posibles sobrescrituras concurrentes de estado |
| Validación PDF superficial | Alto | No protege contra contenido malicioso o archivos enormes |
| URL de backend fija como default | Medio | Acopla ambientes y puede apuntar a un recurso retirado |
| CORS | Alto | El propio cliente contempla bloqueos cross-origin |
| Permisos amplios o mal definidos | Alto | Deben revisarse tanto el scope delegado como los permisos internos del backend |
| Ausencia de filtrado cliente por usuario | Medio/alto | Todos los elementos visibles dependen exclusivamente de permisos SharePoint |
| Fuentes externas | Medio | Solo se valida esquema HTTP(S); la confianza y autorización del enlace dependen del backend |
| Diferencia SPFx 1.17.4 → 1.18.2 | Bajo/medio | Compatible conceptualmente, pero requiere reconstrucción y pruebas, no copia binaria |
| Sin código backend | Alto | No puede reproducirse exactamente IA, persistencia ni reglas internas |

## 16. Propuesta preliminar de arquitectura nueva

Esta propuesta no se implementa en esta fase.

### 16.1 Componentes recomendados

1. **WebPart SPFx 1.18.2 + React 17 + Fluent UI v8**
   - UI, tema, carga, historial, detalle, estado y chat.
   - `SPHttpClient` para operaciones delegadas sobre SharePoint.
   - `AadHttpClient` para el backend protegido.

2. **SharePoint Online**
   - Lista canónica `TDR_analisis` con nombres internos definidos y aprovisionamiento documentado.
   - Biblioteca dedicada para PDFs, con metadatos, control de acceso y retención.
   - Listas de chat solo si volumen y requisitos lo permiten; para mayor escala, usar almacenamiento backend.

3. **Backend mínimo seguro**
   - Preferentemente Azure Functions o una API ASP.NET modernizada.
   - Validación, antivirus/escaneo, extracción, OCR, IA, prompts, persistencia de chat, idempotencia y auditoría.
   - Managed identity y Key Vault; ningún secreto en SPFx.
   - Contrato OpenAPI versionado y respuestas consistentes.

4. **Capa de IA**
   - Azure OpenAI u otro servicio aprobado.
   - Si se requiere RAG, índice y permisos alineados con SharePoint.
   - Fuentes verificables y filtradas según acceso del usuario.

5. **Observabilidad y seguridad**
   - Correlation ID extremo a extremo.
   - Application Insights sin contenido sensible.
   - Límites de archivo/mensaje, rate limiting, timeouts y política CORS explícita.

### 16.2 Reparto propuesto

| Operación | Ubicación futura sugerida |
|---|---|
| Leer/listar/detallar TDR | SPFx → SharePoint REST |
| Actualizar estado | SPFx → SharePoint REST, sujeto a permisos |
| Subir PDF | SPFx → biblioteca o backend, según escaneo/tamaño |
| Crear metadatos finales | Backend o SPFx según modelo de autorización |
| Extraer/analizar PDF | Backend |
| IA y RAG | Backend |
| Sesiones y mensajes | Backend o almacenamiento gestionado, no memoria del navegador |
| Secretos y credenciales | Key Vault/managed identity |

### 16.3 Decisiones previas necesarias

- Reemplazar la solución antigua conservando IDs o desplegar una solución nueva en paralelo.
- Confirmar el esquema real de `TDR_analisis` y la biblioteca de documentos.
- Confirmar si el App Service y app registration todavía existen.
- Definir si los usuarios deben ver todos los TDR o solo los propios.
- Definir retención, clasificación de información, auditoría y seguridad de los PDFs y chats.
- Recuperar, rediseñar o especificar formalmente la lógica de extracción y prompts.

## 17. Inventario de archivos relevantes del SPPKG

### 17.1 Archivos analizados

| Archivo | Tamaño aprox. | Relevancia |
|---|---:|---|
| `[Content_Types].xml` | 1.035 B | Tipos de contenido del paquete |
| `AppManifest.xml` | 1.050 B | Identidad de solución, versión y permiso Web API |
| `ClientSideAssets.xml` | 312 B | Feature de activos cliente |
| `ClientSideAssets.xml.config.xml` | 189 B | ID de configuración de la parte |
| `feature_ff78c760-0367-47d9-acc6-0a50d651dcc0.xml` | 298 B | Feature principal |
| `feature_ff78c760-0367-47d9-acc6-0a50d651dcc0.xml.config.xml` | 189 B | ID de configuración de feature |
| `_rels/.rels` | 288 B | Relación al AppManifest |
| `_rels/AppManifest.xml.rels` | 485 B | Relaciones de manifiesto |
| `_rels/ClientSideAssets.xml.rels` | 1.320 B | Inventario de activos |
| `_rels/feature_....xml.rels` | 560 B | Relación al manifiesto del WebPart |
| `ff78.../WebPart_c230....xml` | 2.797 B | Manifiesto completo del componente y configuración por defecto |
| `ClientSideAssets/sistema-tdr-web-part_4e54233b5d56835d494a.js` | 500.280 B | Lógica, UI, estilos, endpoints y contratos recuperados |
| `ClientSideAssets/sistema-tdr-web-part_....js.LICENSE.txt` | 821 B | Licencia Microsoft del código incluido |
| `ClientSideAssets/SistemaTdrWebPartStrings_en-us_....js` | 297 B | Textos del panel de propiedades |
| `ClientSideAssets/c230..._color.png` | 10.248 B | Icono color del componente |
| `ClientSideAssets/c230..._outline.png` | 542 B | Icono outline del componente |

Todos los archivos del SPPKG extraído fueron inventariados. Los PNG se identificaron como iconos por nombre, relación de paquete y tipo; no contienen configuración ejecutable.

### 17.2 GUID e identificadores recuperados

| Identificador | Valor | Significado |
|---|---|---|
| Product ID antiguo | `f6a1faca-4250-4c25-b882-7bbf30d4509f` | Identidad de solución empaquetada |
| Component ID antiguo | `c230d6b4-4627-4e6d-b15f-373b2674ef3f` | WebPart Sistema TDR |
| Feature ID antiguo | `ff78c760-0367-47d9-acc6-0a50d651dcc0` | Feature de solución |
| Client assets feature | `0cfe0110-4a61-4f3b-b041-5299bb163b33` | Feature estándar de activos |
| App part config | `d0e27cc6-13f6-4f5e-9502-aa03f0337c88` | Configuración interna del paquete |
| Feature config | `1f081e4f-9efa-48d6-b409-dcbe564a785b` | Configuración interna del paquete |
| API resource URI | `api://b02153e0-a22d-4fef-8ed1-7fa0d3769a57` | Audience solicitada a Entra ID |
| Grupo toolbox | `5c03119e-3074-46fd-976b-c60198311f70` | Grupo “Advanced” |
| IDs de componentes SPFx/React | Varios GUID estándar Microsoft | Referencias runtime, no IDs de negocio |

### 17.3 Proyecto SPFx nuevo analizado

Se revisaron, sin modificar:

- `.yo-rc.json`
- `package.json` y `package-lock.json`
- `tsconfig.json`
- `gulpfile.js`
- `config/config.json`
- `config/package-solution.json`
- `config/serve.json`
- `config/write-manifests.json`
- `src/index.ts`
- `src/webparts/sistemaTdr/SistemaTdrWebPart.manifest.json`
- `src/webparts/sistemaTdr/SistemaTdrWebPart.ts`
- `src/webparts/sistemaTdr/components/SistemaTdr.tsx`
- `src/webparts/sistemaTdr/components/ISistemaTdrProps.ts`
- `src/webparts/sistemaTdr/components/SistemaTdr.module.scss`
- `src/webparts/sistemaTdr/loc/en-us.js`
- `src/webparts/sistemaTdr/loc/mystrings.d.ts`
- Imágenes estándar generadas por Yeoman en `src` y `teams`.

### 17.4 Adecuación de la base nueva

La base es correcta:

- SPFx 1.18.2 compatible con Node 18.20.4 según el `engines` del proyecto.
- React 17.0.1 coincide con la versión del paquete recuperado.
- Fluent UI v8 ya está declarado; el lock instaló 8.125.7 por el rango `^8.106.4`.
- TypeScript 4.7.4 y el toolchain corresponden a SPFx 1.18.2.
- Hosts y soporte de tema coinciden conceptualmente con el WebPart anterior.

Diferencias que deberán resolverse en una fase de implementación:

- IDs de solución, feature y componente nuevos y distintos a los anteriores.
- Manifest nuevo todavía genérico (`Page`, descripción y propiedad `description`).
- No existe `webApiPermissionRequests` en `config/package-solution.json`.
- No está declarada directamente la dependencia `@microsoft/sp-http`.
- Falta la propiedad `apiBaseUrl` y sus textos.
- `src` contiene únicamente la plantilla Yeoman.
- `npm ls --depth=0` informó tres módulos extraneous (`bindings`, `file-uri-to-path`, `nan`); no se alteraron porque esta fase prohíbe instalaciones o actualizaciones.

No se ejecutó build porque generaría artefactos y excedería el alcance de solo documentación.

## 18. Inventario consolidado de información importante

| Categoría | Valor | Estado |
|---|---|---|
| API base | `https://sistematdr-g4c5asddesgbd7bh.southcentralus-01.azurewebsites.net` | Confirmado, configurable |
| API resource | `api://b02153e0-a22d-4fef-8ed1-7fa0d3769a57` | Confirmado |
| Scope | `access_as_user` | Confirmado |
| Resource name | `SistemaTDR API` | Confirmado |
| Tenant ID | No encontrado | Desconocido |
| Site URL | `pageContext.web.absoluteUrl` | Dinámico; URL concreta desconocida |
| Lista | `TDR_analisis` | Confirmado |
| List ID | No encontrado | Desconocido |
| Biblioteca/ruta documentos | Campo URL detectado dinámicamente | Nombre/ruta desconocidos |
| Graph | Sin llamadas | No usado en evidencia recuperada |
| REST SharePoint | Fields, items, item por ID y PATCH | Confirmado |
| Almacenamiento navegador | Solo claves internas Fluent UI `isRTL`/`language` | No funcional del TDR |
| Correlation header | `X-Correlation-ID` | Confirmado para chat |
| Secretos/credenciales | No encontrados | Confirmado por inspección estática |
| CORS | Requerido por API externa | Confirmado por manejo explícito de error |

## 19. Conclusión

El SPPKG permite reconstruir con alta fidelidad el cliente SPFx, los contratos HTTP, la lista utilizada y el comportamiento visual. No permite reconstruir fielmente el núcleo de negocio del análisis ni del chat, porque ambos residían en el backend ASP.NET y probablemente en servicios Azure/IA cuya configuración no fue empaquetada.

La mejor ruta es conservar en SPFx las operaciones SharePoint delegadas y reemplazar el backend antiguo por una API mínima segura y documentada. Antes de programar debe validarse el entorno real: lista y columnas, biblioteca, app registration, permiso aprobado, disponibilidad del App Service y reglas de acceso por usuario.

No se modificó ningún archivo del proyecto existente. El único archivo creado por esta fase es `ANALISIS_SISTEMA_TDR.md`.

## Reconstrucción realizada

Fecha de reconstrucción: 2026-09-25.

### Archivos creados

- `src/webparts/sistemaTdr/models/TdrModels.ts`
- `src/webparts/sistemaTdr/services/TdrApiService.ts`
- `src/webparts/sistemaTdr/services/TdrSharePointService.ts`
- `src/webparts/sistemaTdr/services/TdrChatService.ts`
- `src/webparts/sistemaTdr/components/AnalysisResult.tsx`
- `src/webparts/sistemaTdr/components/TdrHistory.tsx`
- `src/webparts/sistemaTdr/components/ChatPanel.tsx`
- `src/webparts/sistemaTdr/components/SistemaTdr.module.scss.ts` (generado automáticamente por la tarea Sass de SPFx)

### Archivos modificados

- `src/webparts/sistemaTdr/SistemaTdrWebPart.ts`
- `src/webparts/sistemaTdr/SistemaTdrWebPart.manifest.json`
- `src/webparts/sistemaTdr/components/SistemaTdr.tsx`
- `src/webparts/sistemaTdr/components/ISistemaTdrProps.ts`
- `src/webparts/sistemaTdr/components/SistemaTdr.module.scss`
- `src/webparts/sistemaTdr/loc/en-us.js`
- `src/webparts/sistemaTdr/loc/mystrings.d.ts`
- `config/package-solution.json`
- `package.json`
- `package-lock.json`
- `ANALISIS_SISTEMA_TDR.md`

Los GUID existentes de la solución, feature y WebPart nuevos se conservaron. No se intentó sustituir los GUID de producción.

### Servicios reconstruidos

- **TdrApiService:** adquisición de `AadHttpClient`, carga `multipart/form-data` bajo la parte `archivo`, llamada a `/api/tdr/analizar`, tolerancia a envoltorios y variantes de nombres JSON, normalización del resultado y mensajes HTTP/red recuperados.
- **TdrSharePointService:** detección dinámica de campos por nombre interno o título normalizado; consulta de campos, primeros 50 elementos, `@odata.nextLink`, detalle por ID, expansión de Author, interpretación del enlace PDF y `PATCH` de Estado con `IF-MATCH: *`.
- **TdrChatService:** bootstrap con fallback exclusivo ante 404, apertura de sesión, historial, nueva conversación, envío de mensajes, tolerancia a variantes JSON, fuentes, correlación, ordenación y logging SPFx.

### Componentes reconstruidos

- WebPart y propiedad configurable `apiBaseUrl`.
- Cabecera y navegación Pivot.
- Zona de selección y drag-and-drop de PDF.
- Resultado del análisis con las once tarjetas recuperadas.
- Historial responsivo de TDR, búsqueda, paginación y acciones.
- Vista de detalle, secciones, enlace y cambio de Estado.
- Panel lateral de chat, historial, nueva conversación, envío y fuentes.
- Estados de carga, vacíos, éxito y errores.
- Estilos responsivos y soporte de tokens de tema de SharePoint.

### Funcionalidades recuperadas

- Validación cliente de extensión, MIME y archivo vacío.
- URL predeterminada del App Service recuperado.
- Resource URI `api://b02153e0-a22d-4fef-8ed1-7fa0d3769a57`.
- Permiso `SistemaTDR API / access_as_user` en `webApiPermissionRequests`.
- Todos los endpoints de análisis y chat inventariados.
- Lista `TDR_analisis`, detección flexible de columnas y operaciones REST recuperadas.
- Valores de Estado compatibles con el bundle.
- Contratos flexibles de análisis, sesión, mensajes y fuentes.
- Límite de 4.000 caracteres, UUID cliente, deduplicación y orden de mensajes.

### Diferencias o limitaciones

- No fue posible verificar la ejecución real contra SharePoint Online, la lista, la app registration o Azure App Service desde el build local.
- La implementación del backend, análisis PDF e IA no fue reconstruida ni modificada; el WebPart conserva sus contratos existentes.
- Los GUID del proyecto nuevo se mantuvieron y, por tanto, esta solución no reemplaza automáticamente el paquete antiguo instalado.
- Los elementos visuales se reconstruyeron como TypeScript/React mantenible usando Fluent UI v8; no se dispone del código fuente ni de capturas del original para efectuar comparación visual píxel a píxel.
- `npm install` mostró advertencias `EBADENGINE` procedentes de dependencias transitivas Azure que actualmente declaran Node 22, además del inventario de vulnerabilidades heredado del árbol SPFx. No se actualizaron paquetes ni se ejecutó `npm audit fix`, porque implicaría cambios de versiones fuera del alcance. Estas advertencias no aparecieron en el build de SPFx.

### Resultado de validación y build

- `npx tsc --noEmit`: **correcto**, cero errores.
- `npm run build` (`gulp bundle`, target DEBUG): **correcto**, cero errores y cero warnings.
- Node usado: `v18.20.4`.
- Build tools reportado: `3.18.1`.
- No se ejecutó empaquetado de producción, despliegue ni llamadas a SharePoint/Azure.
- El build generó los artefactos locales normales de SPFx en `lib` y `temp`; no se creó ni desplegó un `.sppkg` de producción.
