# Checklist RT — Hospital do Coração de Natal
> Auditoria Mensal de Processos | Responsável Técnico  
> Grupo Atena — Natal/RN

Sistema web mobile-first para preenchimento do checklist de auditoria mensal por UTI, com dashboard de conformidade e exportação PDF.

---

## Estrutura de Arquivos

```
checklist-rt-hcn/
├── index.html          ← Ponto de entrada (SPA)
├── style.css           ← Estilos completos (paleta HCN)
├── app.js              ← Lógica principal + Firebase + Render
├── firebase-config.js  ← ⚠️ Configuração do seu Firebase (editar)
├── manifest.json       ← PWA manifest
└── README.md
```

---

## Configuração (Passo a Passo)

### 1. Criar projeto Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Clique em **"Adicionar projeto"**
3. Nome: `checklist-rt-hcn` (ou qualquer nome)
4. Ative o Google Analytics se quiser (opcional)

### 2. Configurar Authentication

1. No painel Firebase → **Authentication → Primeiros passos**
2. Aba **"Sign-in method"** → Ativar **Google**
3. Salvar

### 3. Criar Firestore

1. **Firestore Database → Criar banco de dados**
2. Modo: **Produção** (editar regras depois)
3. Região: `southamerica-east1` (São Paulo)

### 4. Regras de Segurança Firestore

No painel Firestore → **Regras**, cole:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /auditorias/{docId} {
      allow read, write: if request.auth != null
        && request.auth.token.email == "SEU_EMAIL@gmail.com";
    }
  }
}
```

> Substitua `SEU_EMAIL@gmail.com` pelo seu e-mail do Google.

### 5. Pegar as credenciais

1. Firebase → **Configurações do projeto** (ícone ⚙️)
2. **"Seus aplicativos"** → Clique em **</>** (Web)
3. Registre o app com nome `checklist-rt-hcn-web`
4. Copie o objeto `firebaseConfig`

### 6. Editar firebase-config.js

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "checklist-rt-hcn.firebaseapp.com",
  projectId: "checklist-rt-hcn",
  storageBucket: "checklist-rt-hcn.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc..."
};
export default firebaseConfig;
```

### 7. Autorizar domínio GitHub Pages

1. Firebase → **Authentication → Settings → Domínios autorizados**
2. Adicione: `SEU_USUARIO.github.io`

### 8. Criar repositório e publicar

```bash
# No terminal:
git init
git add .
git commit -m "feat: checklist RT HCN v1.0"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/checklist-rt-hcn.git
git push -u origin main
```

Depois:
- GitHub → repositório → **Settings → Pages**
- Source: **Deploy from a branch → main → / (root)**
- Aguarde ~1 min → URL: `https://SEU_USUARIO.github.io/checklist-rt-hcn`

---

## Como Usar

### Fluxo Mensal

```
Login Google
    ↓
Selecionar Mês + UTI
    ↓
Preencher Checklist (semanas 1–5)
  → C = Conforme  |  NC = Não Conforme
  → Salvar (💾) ao finalizar cada UTI
    ↓
Repetir para as 5 UTIs
    ↓
Ver Dashboard → % por UTI e por Indicador
    ↓
Exportar PDF (botão 📄 ou Ctrl+P)
```

### Estrutura de Dados no Firestore

Cada documento tem a chave: `YYYY-MM_UTI_X_Y`  
Ex: `2025-05_UTI_1_A`, `2025-05_UTI_2_B`

```json
{
  "uid": "google-user-id",
  "mes": "2025-05",
  "uti": "UTI 1/A",
  "dados": {
    "s1_cme_7": "C",
    "s1_cme_9": "NC",
    "s2_desfib_12": "C"
  },
  "updatedAt": "2025-05-12T14:30:00.000Z"
}
```

---

## UTIs e Dias de Auditoria

| UTI      | CME     | Laringo | Desfib  | Notas                |
|----------|---------|---------|---------|----------------------|
| UTI 1/A  | 3ª e 5ª | 5ª      | 2ª e 6ª | Padrão               |
| UTI 1/B  | 3ª e 5ª | 5ª      | 2ª e 6ª | Padrão               |
| UTI 2/A  | 3ª e 5ª | 5ª      | 2ª e 6ª | Padrão               |
| UTI 2/B  | 2ª e 5ª | 4ª      | 2ª e 6ª | ⚠️ Dias próprios     |
| UTI 3/A  | 3ª e 5ª | 5ª      | 2ª e 6ª | Padrão               |

---

## Tecnologias

- **Frontend:** HTML5 + CSS3 + Vanilla JS (ES Modules)
- **Auth:** Firebase Authentication (Google)
- **Banco:** Cloud Firestore
- **Hospedagem:** GitHub Pages
- **PWA:** Manifest configurado (adicionar à tela inicial)
- **PDF:** `window.print()` com CSS @media print

---

*Hospital do Coração de Natal — Grupo Atena*  
*Sistema desenvolvido para uso exclusivo do Responsável Técnico*
