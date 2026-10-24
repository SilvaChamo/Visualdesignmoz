<?php
/**
 * Script de Restauração WordPress - aamihe.com
 * Colocar em: /home/aamihe/domains/aamihe.com/public_html/restore.php
 * Aceder via: https://aamihe.com/restore.php
 */

// Configurações
$domain = 'aamihe.com';
$user = 'aamihe';
$publicHtml = '/home/aamihe/domains/aamihe.com/public_html/';
$backupDir = '/home/aamihe/';

// Tentar encontrar o ficheiro de backup
$backupFiles = [];
foreach (glob($backupDir . '*.tar*') as $file) {
    $backupFiles[] = $file;
}
foreach (glob($publicHtml . '*.tar*') as $file) {
    $backupFiles[] = $file;
}

if (empty($backupFiles)) {
    die("❌ ERRO: Nenhum ficheiro .tar ou .tar.gz encontrado!<br>\n");
}

$backupFile = $backupFiles[0];
echo "✅ Ficheiro de backup encontrado: $backupFile<br>\n";

// 1. Listar conteúdo do backup
echo "📦 Analisando conteúdo do backup...<br>\n";
$contents = shell_exec("tar -tf '$backupFile' 2>&1");
echo "<pre>" . htmlspecialchars(substr($contents, 0, 2000)) . "...</pre><br>\n";

// Verificar se tem SQL
$hasSql = strpos($contents, '.sql') !== false;
if ($hasSql) {
    echo "✅ Encontrado ficheiro SQL no backup!<br>\n";
}

// 2. Extrair tudo para public_html
echo "📂 A extrair ficheiros para $publicHtml ...<br>\n";
exec("cd '$publicHtml' && tar -xzf '$backupFile' --overwrite 2>&1", $output, $returnCode);

if ($returnCode !== 0) {
    // Tentar sem compressão (tar simples)
    exec("cd '$publicHtml' && tar -xf '$backupFile' --overwrite 2>&1", $output2, $returnCode2);
    if ($returnCode2 !== 0) {
        die("❌ ERRO ao extrair: " . implode("\n", $output) . "<br>\n");
    }
}

echo "✅ Ficheiros extraídos com sucesso!<br>\n";

// 3. Listar o que foi extraído
echo "📋 Conteúdo extraído:<br>\n";
$extracted = shell_exec("ls -la '$publicHtml' 2>&1");
echo "<pre>$extracted</pre><br>\n";

// 4. Procurar wp-config.php
$wpConfigPath = null;
if (file_exists($publicHtml . 'wp-config.php')) {
    $wpConfigPath = $publicHtml . 'wp-config.php';
} else {
    // Procurar em subpastas
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($publicHtml, RecursiveDirectoryIterator::SKIP_DOTS)
    );
    foreach ($iterator as $file) {
        if ($file->getFilename() === 'wp-config.php') {
            $wpConfigPath = $file->getPathname();
            break;
        }
    }
}

// 5. Se encontrou SQL, restaurar base de dados
if ($hasSql) {
    echo "🗄️ A procurar e restaurar base de dados...<br>\n";
    
    // Extrair o SQL temporariamente
    exec("cd '$publicHtml' && tar -xzf '$backupFile' --wildcards '*.sql' 2>&1");
    
    // Procurar o ficheiro SQL
    $sqlFiles = [];
    foreach (glob($publicHtml . '*.sql') as $sql) {
        $sqlFiles[] = $sql;
    }
    
    if (!empty($sqlFiles)) {
        $sqlFile = $sqlFiles[0];
        echo "✅ Ficheiro SQL encontrado: $sqlFile<br>\n";
        
        // Ler credenciais do wp-config.php se existir
        $dbName = $user . '_wp';
        $dbUser = $user . '_wp';
        $dbPass = substr(str_shuffle('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'), 0, 16);
        
        if ($wpConfigPath && file_exists($wpConfigPath)) {
            $wpConfig = file_get_contents($wpConfigPath);
            if (preg_match("/define\s*\(\s*['\"]DB_NAME['\"]\s*,\s*['\"](.+?)['\"]\s*\)/", $wpConfig, $matches)) {
                $dbName = $matches[1];
            }
            if (preg_match("/define\s*\(\s*['\"]DB_USER['\"]\s*,\s*['\"](.+?)['\"]\s*\)/", $wpConfig, $matches)) {
                $dbUser = $matches[1];
            }
            if (preg_match("/define\s*\(\s*['\"]DB_PASSWORD['\"]\s*,\s*['\"](.+?)['\"]\s*\)/", $wpConfig, $matches)) {
                $dbPass = $matches[1];
            }
        }
        
        echo "🗄️ Base de dados: $dbName | User: $dbUser<br>\n";
        
        // Criar base de dados e utilizador via DirectAdmin API (simplificado)
        // Ou usar mysql diretamente se tivermos acesso
        echo "⚠️ IMPORTANTE: Criar a base de dados '$dbName' no DirectAdmin antes de importar!<br>\n";
        echo "⚠️ Utilizador: '$dbUser' com password: '$dbPass'<br>\n";
        
        // Tentar importar se mysql estiver disponível
        $mysqlCmd = "mysql -u$dbUser -p'$dbPass' $dbName < '$sqlFile' 2>&1";
        echo "💾 Comando para importar (executar no terminal):<br>\n";
        echo "<code>$mysqlCmd</code><br>\n";
    }
}

// 6. Ajustar permissões
echo "🔧 A ajustar permissões...<br>\n";
exec("chown -R $user:$user '$publicHtml' 2>&1");
exec("find '$publicHtml' -type d -exec chmod 755 {} \; 2>&1");
exec("find '$publicHtml' -type f -exec chmod 644 {} \; 2>&1");

// 7. Verificar se WordPress está funcional
if (file_exists($publicHtml . 'wp-config.php') || file_exists($publicHtml . 'wordpress/wp-config.php')) {
    echo "✅ WordPress detectado!<br>\n";
    
    // Mostrar instruções finais
    echo "<h2>🎉 RESTAURAÇÃO CONCLUÍDA!</h2>\n";
    echo "<p>Acesse o site: <a href='https://$domain' target='_blank'>https://$domain</a></p>\n";
    echo "<p>Se a base de dados não foi importada automaticamente:</p>\n";
    echo "<ol>\n";
    echo "<li>Crie a base de dados no DirectAdmin (MySQL Management)</li>\n";
    echo "<li>Importe o ficheiro .sql via phpMyAdmin</li>\n";
    echo "<li>Verifique o wp-config.php tem as credenciais corretas</li>\n";
    echo "</ol>\n";
} else {
    echo "⚠️ wp-config.php não encontrado na raiz. Verifique se o backup contém WordPress.<br>\n";
}

echo "<hr><p>🗑️ <b>APAGAR ESTE SCRIPT</b> após uso por segurança:<br>\n";
echo "<code>rm '$publicHtml/restore.php'</code></p>\n";
?>
