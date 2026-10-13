<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/auth.php';
requestMethod('GET');
respond(200,['csrf_token'=>csrfToken()]);
