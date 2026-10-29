// Dicionário português → inglês do painel, por zonas (auditoria de 27/10/2026). Junta ao `EN` de generated/data.ts as linhas
// que lá faltam (as que já existem não se mudam). `npm run i18n:painel` lista o que ainda não tem inglês.
import { EN } from '../generated/data';
import { nucleo } from './01-nucleo';
import { nucleo_b } from './02-nucleo-b';
import { comuns_a } from './03-comuns-a';
import { paginas_pequenas } from './04-paginas-pequenas';
import { admin_servidor } from './05-admin-servidor';
import { admin_servidor_2 } from './06-admin-servidor-2';
import { contas_sistema } from './07-contas-sistema';
import { suporte } from './08-suporte';
import { email } from './09-email';
import { avancado } from './10-avancado';
import { dominios } from './11-dominios';
import { modelos } from './12-modelos';
import { extras } from './13-extras';
import { mensagens_api } from './14-mensagens-api';
import { mensagens_lib } from './15-mensagens-lib';
import { externos } from './16-externos';
import { php_extensoes } from './17-php-extensoes';
import { modelos_renovacao } from './18-modelos-renovacao';
import { revenda } from './19-revenda';
import { residuos } from './20-residuos';
import { compras } from './21-compras';

const TRADUCOES: Record<string, string> = { ...nucleo, ...nucleo_b, ...comuns_a, ...paginas_pequenas, ...admin_servidor, ...admin_servidor_2, ...contas_sistema, ...suporte, ...email, ...avancado, ...dominios, ...modelos, ...extras, ...mensagens_api, ...mensagens_lib, ...externos, ...php_extensoes, ...modelos_renovacao, ...revenda, ...residuos, ...compras };
for (const [pt, en] of Object.entries(TRADUCOES)) if (!(pt in EN)) EN[pt] = en;
