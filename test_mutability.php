<?php require "backend/vendor/autoload.php"; $img = Intervention\Image\ImageManager::gd()->create(100, 100); $img2 = $img->scaleDown(width: 50); echo $img === $img2 ? "mutable" : "immutable";
