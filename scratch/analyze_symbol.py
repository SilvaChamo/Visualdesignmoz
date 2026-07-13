import sys
from PIL import Image

try:
    img = Image.open('public/assets/simbolo.png')
    bbox = img.getbbox()
    width, height = img.size
    print(f"Original size: {width}x{height}")
    print(f"Bounding box of visual content: {bbox}")
    if bbox:
        bbox_w = bbox[2] - bbox[0]
        bbox_h = bbox[3] - bbox[1]
        print(f"Content dimensions: {bbox_w}x{bbox_h}")
        print(f"Center of content: {bbox[0] + bbox_w/2}, {bbox[1] + bbox_h/2}")
except Exception as e:
    print(f"Error: {e}")
