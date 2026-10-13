"""Bundle the approved heart references for offline PPT embedding."""
from pathlib import Path
import shutil
import sys
from PIL import Image


def prepare(source):
    destination = Path(__file__).resolve().parents[1] / "public/images/heart-teaching-views"
    destination.mkdir(parents=True, exist_ok=True)
    for original, name in (("heart-front-view.jpg", "front.jpg"),
                           ("heart-overhead-view.jpg", "overhead.jpg"),
                           ("heart-top-orthographic.jpg", "top.jpg")):
        shutil.copyfile(source / original, destination / name)
    with Image.open(source / "heart-three-views-final.jpg") as image:
        image.crop((image.width // 3, 0, image.width * 2 // 3, image.height)).save(destination / "oblique.jpg", quality=95)


if __name__ == "__main__":
    prepare(Path(sys.argv[1]))
