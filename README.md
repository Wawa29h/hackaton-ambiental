# 🪸 Coral Watch — Monitor del Arrecife Mesoamericano

Sistema de monitoreo de la salud de arrecifes coralinos del **Arrecife Mesoamericano** (México, Honduras, Nicaragua y El Salvador), basado en datos de NOAA Coral Reef Watch y alertas generadas con IA en español simple para comunidades pesqueras.

---

## ¿Qué hace este proyecto?

1. **Consume datos de NOAA Coral Reef Watch** — temperatura superficial del mar (SST), bleaching alerts, Degree Heating Weeks (DHW) y más.
2. **Analiza condiciones por país y arrecife** — cruza datos satelitales con ubicaciones conocidas del SAM (Sistema Arrecifal Mesoamericano).
3. **Genera alertas con IA** — usa Claude API para traducir datos técnicos a mensajes claros en español, adaptados para pescadores y comunidades costeras.
4. **Visualiza el estado** — tablero web interactivo con mapa y semáforo de salud por arrecife.

---

## Cobertura geográfica

| País | Zona principal |
|------|---------------|
| 🇲🇽 México | Banco Chinchorro, Cozumel, Sian Ka'an |
| 🇧🇿 Belice | Barrera de coral de Belice |
| 🇬🇹 Guatemala | Bahía de Amatique |
| 🇭🇳 Honduras | Islas de la Bahía (Roatán, Utila, Guanaja) |

---

## Estructura del proyecto

```
coral-watch/
├── frontend/          # Interfaz web (React + Vite)
├── backend/           # API y lógica de negocio (FastAPI + Python)
│   ├── api/           # Endpoints REST
│   ├── services/      # Integración NOAA y Claude API
│   └── models/        # Schemas de datos
├── data/
│   └── seed/          # JSONs demo con datos de arrecifes por país
├── ai/
│   └── prompts/       # Plantillas de prompts para Claude API
├── .env.example       # Variables de entorno requeridas
└── README.md
```

---

## Variables de entorno

Copia `.env.example` a `.env` y rellena tus claves:

```bash
cp .env.example .env
```

| Variable | Descripción |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Clave de API de Anthropic para generar alertas con Claude |
| `NOAA_API_KEY` | Clave de NOAA Coral Reef Watch para datos satelitales |

---

## Alertas para comunidades pesqueras

Las alertas generadas por Claude usan lenguaje directo y sin tecnicismos, por ejemplo:

> **⚠️ Alerta Roatán, Honduras** — El agua está más caliente de lo normal esta semana. Los corales en la zona norte de Roatán podrían blanquearse en los próximos días. Se recomienda evitar anclar en esa área y reportar cualquier coral blanco al centro de monitoreo.

---

## Tecnologías

- **Frontend:** React 18, Vite, Leaflet (mapas), TailwindCSS
- **Backend:** Python 3.11+, FastAPI, httpx
- **IA:** Claude API (Anthropic) — modelo `claude-sonnet-4-6`
- **Datos:** NOAA Coral Reef Watch REST API

---

## Estado del proyecto

🚧 En desarrollo inicial — estructura y datos de prueba.
