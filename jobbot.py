"""
8Oapply - Backward Compatibility Layer
This module bridges legacy references from 'jobbot' to 'eight_o_apply'.
"""
import sys
from pathlib import Path
import eight_o_apply
from eight_o_apply import *

if __name__ == "__main__":
    eight_o_apply.main()
