# Check list de montacargas

Sitio estático para GitHub Pages, con inspecciones compartidas en Supabase. La interfaz original está separada en HTML, CSS y JavaScript. El sitio está publicado en https://coello021.github.io/checklist-montacargas/ y conectado al proyecto Supabase `checklist-montacargas`. El esquema SQL se aplicó y existe una cuenta inicial autorizada como `operator`. El 25 de septiembre de 2026 se verificaron el inicio de sesión, el guardado de un registro de prueba, una actualización con versiones 1 y 2 en el historial y la descarga Excel. El registro de prueba permanece en Supabase con la unidad `UNIDAD DE PRUEBA` y sin casillas marcadas.

## Estructura

- `index.html`: formulario, registros e inicio de sesión.
- `assets/css/styles.css`: estilos.
- `assets/js/app.js`: lógica de inspecciones, historial, Excel y respaldo.
- `assets/js/config.js`: URL y clave **publicable** del proyecto Supabase.
- `supabase/schema.sql`: tablas, historial y reglas de acceso.

## Preparar Supabase en otro proyecto

1. Crea un proyecto Supabase. En el **SQL Editor**, ejecuta `supabase/schema.sql` una vez. Hazlo en un proyecto nuevo; el script crea tablas y políticas.
2. En **Authentication > Users**, crea las cuentas de los operadores. No habilites el alta pública para este uso interno.
3. Para cada cuenta, copia su UUID y agrégalo a `public.app_users` en el SQL Editor:

   ```sql
   insert into public.app_users(user_id,display_name,role)
   values ('UUID-REAL-DEL-USUARIO','Nombre','operator');
   ```

4. En **Project Settings > API** (o **Connect**, según la interfaz), copia la URL y la clave **publishable** a `assets/js/config.js`. La clave publishable está diseñada para usarse en el navegador porque las tablas tienen RLS. Nunca pongas una secret key ni `service_role` en el repositorio.
5. En Authentication, agrega la URL final de GitHub Pages a **URL Configuration / Site URL** si usas enlaces de recuperación o confirmación por correo.

Solo las cuentas presentes en `app_users` pueden ver y escribir registros. El campo `role` distingue `operator` y `admin`, pero las políticas actuales conceden a ambos el mismo acceso a las inspecciones; el propietario del proyecto se administra por separado en Supabase. La pantalla de historial conserva cada versión de un registro; archivar quita la semana de la lista activa, pero no borra su historial.

## Publicar GitHub Pages

1. Sube **el contenido de esta carpeta**, con `index.html` en la raíz, a un repositorio nuevo.
2. En **Settings > Pages > Build and deployment**, selecciona **Deploy from a branch**, `main`, `/ (root)`.
3. Abre `https://TU-USUARIO.github.io/NOMBRE-REPOSITORIO/` y prueba el inicio de sesión con un usuario autorizado.
4. Guarda una semana en un dispositivo, entra desde otro y pulsa **Actualizar** en Registros. Abre **Historial** para ver versiones. Descarga Excel o imprime desde la inspección abierta.

La URL y la clave publishable de Supabase pueden estar en el frontend; la protección real depende de Authentication y RLS. Si el repositorio es público, su código y `config.js` también lo son. Los datos siguen en Supabase y requieren autorización.

## Migración y uso

- La versión original guardaba registros en `localStorage` o JSONBin. Descarga su respaldo JSON desde la versión original e impórtalo desde **Registros > Importar respaldo JSON** con una cuenta autorizada.
- La importación agrega IDs inexistentes y omite IDs duplicados; no sobrescribe semanas existentes.
- Esta versión consulta Supabase al entrar y al pulsar **Actualizar**. El botón **Guardar semana** exige inspector, sucursal, unidad, inicio y fin de semana válidos y al menos una casilla C o NC. Permite guardar una revisión parcial, que aparece como **En proceso**. Confirma la escritura antes de decir que guardó.
- Si otra persona guardó la misma semana, se rechaza la versión antigua. Pulsa **Actualizar**, abre la versión reciente y revisa los cambios. Los cambios que no habías guardado no se combinan automáticamente.
- Crear **Nueva semana** siempre crea otro ID; una unidad y fecha repetidas no se fusionan automáticamente.
- Excel depende de la biblioteca XLSX cargada desde CDN; las fuentes de Google también requieren internet.
- Descarga respaldos JSON de forma periódica y consérvalos en un lugar autorizado por tu organización.
