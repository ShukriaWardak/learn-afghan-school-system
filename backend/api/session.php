<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
requestMethod('GET');
$u=authenticatedUser(database());
respond(200,['authenticated'=>true,'user'=>publicUser($u),'csrf_token'=>csrfToken()]);
