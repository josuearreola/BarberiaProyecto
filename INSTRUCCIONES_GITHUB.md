# 📤 Instrucciones para Subir a GitHub

## ✅ Repositorio Git Inicializado

Ya tienes un repositorio Git local inicializado con todos los archivos comprometidos.

**Commit inicial realizado:**
- ✅ 76 archivos agregados
- ✅ Backend completo (NestJS)
- ✅ Frontend completo (Angular)
- ✅ Script SQL para la base de datos
- ✅ Documentación (README.md y CONFIGURACION_SISTEMA.md)
- ✅ .gitignore configurado
- ✅ .env.example creado (tu .env está protegido)

## 🚀 Pasos para Subir a GitHub

### Opción 1: Usando GitHub CLI (gh)

Si tienes GitHub CLI instalado:

```powershell
# Autenticar
gh auth login

# Crear repositorio y hacer push
gh repo create barberia-agendamiento --private --source=. --push
```

### Opción 2: Usando la Web de GitHub (Recomendado)

#### 1. Crear el Repositorio en GitHub

1. Ve a https://github.com/new
2. Nombre del repositorio: `barberia-agendamiento` (o el nombre que prefieras)
3. Descripción: "Sistema de agendamiento para barbería - NestJS + Angular + PostgreSQL"
4. Selecciona **Privado** o **Público** según prefieras
5. **NO inicialices** con README, .gitignore o licencia (ya los tenemos)
6. Haz clic en **Create repository**

#### 2. Conectar tu Repositorio Local con GitHub

Después de crear el repositorio, GitHub te mostrará comandos. Usa estos:

```powershell
# Agrega el repositorio remoto
git remote add origin https://github.com/TU-USUARIO/barberia-agendamiento.git

# O si prefieres SSH:
# git remote add origin git@github.com:TU-USUARIO/barberia-agendamiento.git

# Cambia a la rama main (si prefieres main en lugar de master)
git branch -M main

# Sube tus archivos a GitHub
git push -u origin main
```

#### 3. Si prefieres quedarte con la rama "master"

```powershell
# Agrega el repositorio remoto
git remote add origin https://github.com/TU-USUARIO/barberia-agendamiento.git

# Sube tus archivos a GitHub
git push -u origin master
```

## 🔐 Verificación de Seguridad

Verifica que estos archivos **NO** se suban a GitHub:

❌ `backend/.env` (contiene tus credenciales de Neon)
❌ `node_modules/`
❌ `dist/`
❌ Archivos de IDE (.vscode, .idea)

✅ **Estos SÍ deben subirse:**
- `backend/.env.example` (plantilla sin credenciales)
- Todo el código fuente
- Archivos de configuración
- README.md y documentación

## 📋 Comandos después del Push Inicial

### Para futuros cambios:

```powershell
# Ver cambios
git status

# Agregar archivos modificados
git add .

# Hacer commit
git commit -m "Descripción de los cambios"

# Subir a GitHub
git push
```

### Comandos útiles:

```powershell
# Ver el historial de commits
git log --oneline

# Ver los repositorios remotos configurados
git remote -v

# Crear una nueva rama
git checkout -b feature/nueva-funcionalidad

# Ver todas las ramas
git branch -a
```

## 🌿 Recomendaciones

1. **Ramas sugeridas:**
   - `main/master` - Producción
   - `develop` - Desarrollo
   - `feature/*` - Nuevas funcionalidades

2. **Commits significativos:**
   - `feat:` para nuevas funcionalidades
   - `fix:` para correcciones
   - `docs:` para documentación
   - `style:` para cambios de estilo
   - `refactor:` para refactorización

3. **Proteger credenciales:**
   - Nunca incluyas archivos `.env` en commits
   - Siempre usa `.env.example` como plantilla
   - Verifica con `git status` antes de hacer `git add .`

## 🎯 Próximos Pasos

Una vez subido a GitHub, puedes:

1. **Configurar GitHub Actions** para CI/CD
2. **Agregar badges** al README (build status, etc.)
3. **Configurar GitHub Pages** para documentación
4. **Invitar colaboradores** si trabajas en equipo
5. **Configurar webhooks** para notificaciones

## 📞 Comandos de Emergencia

Si subiste algo por error:

```powershell
# Ver el último commit
git log -1

# Deshacer el último commit (mantiene cambios)
git reset HEAD~1

# Forzar push (¡cuidado!)
git push -f origin main
```

## ✅ Checklist Final

Antes de hacer push, verifica:

- [ ] El archivo `.env` NO está en el repositorio
- [ ] `node_modules/` NO está en el repositorio
- [ ] El README.md está actualizado
- [ ] Los archivos de configuración son correctos
- [ ] Has probado que el proyecto funciona localmente

## 🎉 ¡Listo!

Una vez hagas `git push`, tu proyecto estará en GitHub y podrás:
- Clonar el repositorio en otras máquinas
- Colaborar con otros desarrolladores
- Ver el historial de cambios
- Configurar CI/CD
- Tener un respaldo en la nube

**Estado actual:**
✅ Repositorio Git inicializado
✅ Primer commit realizado
⏳ Pendiente: Push a GitHub (necesitas crear el repo en GitHub primero)